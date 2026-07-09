/**
 * Sync pending "chưa lưu" từ Pancake Public API.
 *
 * Quy tắc đã lưu (đồng bộ với pending-unsaved-service):
 * 1) Còn đơn Chưa gửi hàng → đã lưu
 * 2) Vừa gửi hàng (7 ngày sau shipped_at) và chưa có tin chốt sau shipped_at → không báo lại
 * 3) Tin chốt (snippet + updated_at) sau lần gửi hàng → báo chưa lưu (đơn mới)
 */
import { jsonResponse } from '../../utils/response.js';
import { normalizeOrderPhone } from '../../utils/order-duplicate-check.js';
import {
    ensurePendingTable,
    evaluatePhoneSavedState,
    POST_SHIP_GRACE_MS,
} from './pending-unsaved-service.js';

const PANCAKE_API_BASE = 'https://pages.fm/api/public_api/v1';
const LOOKBACK_HOURS = 48;
const MAX_PAGES = 3;
const REQUEST_GAP_MS = 220;
/** Hội thoại có has_phone nhưng list chưa trả SĐT → đọc tin gần đây (giới hạn / lần sync) */
const MAX_MESSAGE_LOOKUPS = 12;
const MESSAGE_CURRENT_COUNT = 30;
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUS = 'open';
const DISMISSED_STATUS = 'dismissed';
const RESOLVED_STATUS = 'resolved';
const PHONE_IN_TEXT_RE = /(?:\+84|0)[35789]\d{8}/g;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPancakeConfig(env) {
    const pageId = String(env.PANCAKE_PAGE_ID || '').trim();
    const token = String(env.PANCAKE_PAGE_ACCESS_TOKEN || '').trim();
    return { pageId, token, ok: Boolean(pageId && token) };
}

function toMs(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || value <= 0) return null;
        return value < 1e12 ? value * 1000 : value;
    }
    const raw = String(value).trim();
    if (!raw) return null;
    // Unix seconds / ms
    if (/^\d+(\.\d+)?$/.test(raw)) {
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) return null;
        return n < 1e12 ? n * 1000 : n;
    }
    // ISO / date string
    const parsed = Date.parse(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

/** Thời điểm tin cuối hội thoại (intent) — ưu tiên updated_at */
function conversationIntentAtMs(conv) {
    return toMs(conv?.updated_at)
        || toMs(conv?.updated_time)
        || toMs(conv?.last_message_at)
        || toMs(conv?.last_activity_at)
        || null;
}

function addNormalizedPhone(set, raw) {
    const phone = normalizeOrderPhone(raw);
    if (/^0\d{8,10}$/.test(phone)) set.add(phone);
}

function extractPhonesFromText(text, intoSet) {
    const matches = String(text || '').match(PHONE_IN_TEXT_RE) || [];
    for (const m of matches) addNormalizedPhone(intoSet, m);
}

function extractPhonesFromConversation(conv) {
    const apiPhones = new Set();
    const snippetPhones = new Set();

    const list = Array.isArray(conv?.recent_phone_numbers) ? conv.recent_phone_numbers : [];
    for (const item of list) {
        addNormalizedPhone(apiPhones, item?.phone_number || item?.captured || item);
    }

    // Một số bản ghi chỉ gắn SĐT trên customer / page_customer cho đến khi mở chat
    const customerBags = [
        conv?.from,
        conv?.page_customer,
        ...(Array.isArray(conv?.customers) ? conv.customers : []),
    ].filter(Boolean);

    for (const customer of customerBags) {
        addNormalizedPhone(apiPhones, customer.phone_number || customer.phone || customer.mobile);
        const nested = customer.phone_numbers || customer.recent_phone_numbers || customer.phones;
        if (Array.isArray(nested)) {
            for (const item of nested) {
                addNormalizedPhone(apiPhones, item?.phone_number || item?.captured || item);
            }
        }
    }

    extractPhonesFromText(conv?.snippet, snippetPhones);
    extractPhonesFromText(conv?.message, snippetPhones);
    extractPhonesFromText(conv?.last_message?.original_message || conv?.last_message?.text, snippetPhones);

    const all = new Set([...apiPhones, ...snippetPhones]);
    const hasPhoneFlag = conv?.has_phone === true || conv?.has_phone === 1 || conv?.has_phone === 'true';
    return {
        apiPhones: [...apiPhones],
        snippetPhones: [...snippetPhones],
        phones: [...all],
        hasPhoneFlag,
        hasApiPhones: apiPhones.size > 0 || hasPhoneFlag,
        needsMessageLookup: hasPhoneFlag && all.size === 0,
    };
}

/**
 * Có nên đánh dấu hội thoại này không?
 * - Có recent_phone_numbers / SĐT customer → YES
 * - has_phone nhưng chưa có số → YES (sẽ fetch messages)
 * - Chỉ bắt SĐT từ snippet → cần snippet giống chốt đơn
 */
function shouldConsiderConversation(conv, phoneInfo) {
    if (phoneInfo?.needsMessageLookup) return true;
    if (!phoneInfo?.phones?.length) return false;
    if (phoneInfo.hasApiPhones || phoneInfo.apiPhones.length > 0) return true;
    return isLikelyOrderIntentSnippet(conv?.snippet, phoneInfo.phones);
}

function extractMessageText(msg) {
    if (!msg || typeof msg !== 'object') return String(msg || '').trim();
    const rich = msg.rich_message;
    const candidates = [
        msg.original_message,
        typeof msg.message === 'string' ? msg.message : null,
        typeof msg.message === 'object' ? (msg.message?.text || msg.message?.content || msg.message?.message) : null,
        msg.text,
        msg.snippet,
        msg.content,
        msg.body,
        typeof rich === 'string' ? rich : null,
        rich && typeof rich === 'object' ? (rich.text || rich.content || rich.message || rich.title) : null,
        Array.isArray(msg.attachments)
            ? msg.attachments.map((a) => [a?.name, a?.url, a?.title, a?.description, a?.phone_number, a?.caption].filter(Boolean).join(' ')).join(' ')
            : null,
    ];
    for (const c of candidates) {
        const text = String(c || '').trim();
        if (text) return text;
    }
    // rich_message đôi khi là JSON string chứa text
    if (typeof rich === 'string' && (rich.startsWith('{') || rich.startsWith('['))) {
        try {
            const parsed = JSON.parse(rich);
            const nested = parsed?.text || parsed?.content || parsed?.message || parsed?.title;
            if (nested) return String(nested).trim();
        } catch (_) { /* ignore */ }
    }
    return '';
}

function extractPhonesAndAddressFromMessages(messages) {
    const phones = new Set();
    let bestAddress = '';
    const list = Array.isArray(messages) ? messages : [];

    for (const msg of list) {
        // Field SĐT trực tiếp trên message (Pancake đôi khi gắn riêng)
        addNormalizedPhone(phones, msg?.phone_number || msg?.phone || msg?.mobile);
        if (Array.isArray(msg?.recent_phone_numbers)) {
            for (const item of msg.recent_phone_numbers) {
                addNormalizedPhone(phones, item?.phone_number || item?.captured || item);
            }
        }
        if (Array.isArray(msg?.phone_numbers)) {
            for (const item of msg.phone_numbers) {
                addNormalizedPhone(phones, item?.phone_number || item?.captured || item);
            }
        }

        const text = extractMessageText(msg);
        if (text) extractPhonesFromText(text, phones);

        // Quét object message lồng (tránh page_id)
        collectPhonesFromValue({
            message: msg?.message,
            text: msg?.text,
            original_message: msg?.original_message,
            attachments: msg?.attachments,
            phone_number: msg?.phone_number,
            phone: msg?.phone,
            recent_phone_numbers: msg?.recent_phone_numbers,
            from: msg?.from,
        }, phones);

        if (!text) continue;
        if (isBotcakeGreetingAddress(text) || isWeakSnippetOnly(text)) continue;
        const looksAddress = /(khu|phuong|phường|quan|quận|huyen|huyện|tinh|tỉnh|tp|duong|đường|dia chi|địa chỉ|ấp|ap\b|,)/i.test(text)
            || (text.split(/\s+/).length >= 5
                && /[a-zA-ZÀ-ỹ]/.test(text)
                && /(khu|phuong|phường|quan|quận|huyen|huyện|tinh|tỉnh|tp|duong|đường|xa\b|xã)/i.test(text));
        if (looksAddress && text.length > bestAddress.length) {
            bestAddress = text.slice(0, 220);
        }
    }

    return { phones: [...phones], address: bestAddress };
}

/**
 * Chỉ lookup tin khi thật sự cần (tránh gọi messages cho mọi chat):
 * - has_phone nhưng chưa có số
 * - tin cuối giống địa chỉ/chốt đơn nhưng chưa bắt được SĐT
 * - hội thoại nằm trong top N mới nhất (xử lý ở bước xếp hàng)
 */
function needsPhoneMessageLookup(conv, phoneInfo) {
    if (phoneInfo?.phones?.length) return false;
    if (phoneInfo?.needsMessageLookup || phoneInfo?.hasPhoneFlag) return true;

    const snippet = String(conv?.snippet || '').trim();
    if (!snippet) return false;
    if (/^\[(sticker|image|video|file|audio|attachment|\d+\s*photos?)\]$/i.test(snippet)) return false;

    // Tin cuối giống địa chỉ / chốt đơn nhưng SĐT nằm ở tin trước
    if (/(khu|phuong|phường|quan|quận|huyen|huyện|tinh|tỉnh|tp\.|duong|đường|dia chi|địa chỉ|sdt|sđt|ship|don|đơn)/i.test(snippet)) {
        return true;
    }
    return false;
}

function conversationLookupPriority(conv, phoneInfo) {
    let score = toMs(conv?.updated_at) || toMs(conv?.updated_time) || 0;
    if (phoneInfo?.hasPhoneFlag) score += 1e15;
    if (conv?.seen === false || conv?.unread_count > 0 || conv?.is_read === false) score += 1e14;
    const snippet = String(conv?.snippet || '');
    if (/(sdt|sđt|dia chi|địa chỉ|phuong|phường|tinh|tỉnh)/i.test(snippet)) score += 1e13;
    return score;
}

function isLikelyOrderIntentSnippet(snippet, phones) {
    const text = String(snippet || '').trim();
    if (!text) return false;
    if (/^\[(sticker|image|video|file|audio|attachment)\]$/i.test(text)) return false;
    if (isBotcakeGreetingAddress(text)) return false;
    if (phones.some((p) => text.includes(p))) return true;
    if (/(khu|phuong|phường|quan|quận|huyen|huyện|tinh|tỉnh|tp|duong|đường|ship|don|đơn|dia chi|địa chỉ|,)/i.test(text)) {
        return true;
    }
    // Không coi mọi câu 4+ từ là chốt đơn (tránh greeting Botcake)
    return false;
}

function conversationDisplayName(conv) {
    return String(
        conv?.from?.name
        || conv?.page_customer?.name
        || conv?.customers?.[0]?.name
        || ''
    ).trim();
}

async function fetchConversationsPage(pageId, token, since, until, pageNumber) {
    const url = new URL(`${PANCAKE_API_BASE}/pages/${encodeURIComponent(pageId)}/conversations`);
    url.searchParams.set('page_access_token', token);
    url.searchParams.set('since', String(since));
    url.searchParams.set('until', String(until));
    url.searchParams.set('page_number', String(pageNumber));

    const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
    });

    if (res.status === 429) {
        await sleep(1200);
        const retry = await fetch(url.toString(), {
            method: 'GET',
            headers: { Accept: 'application/json' },
        });
        if (!retry.ok) throw new Error(`Pancake API HTTP ${retry.status}`);
        return retry.json();
    }

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Pancake API HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    return res.json();
}

/**
 * Lấy tin gần đây khi list conversation chưa hydrate SĐT
 * (thường gặp khi chưa mở box trên desktop).
 */
async function fetchRecentMessages(pageId, token, conversationId) {
    const idVariants = [conversationId];
    // Một số endpoint chỉ nhận phần sau pageId_
    if (conversationId.includes('_')) {
        const suffix = conversationId.split('_').slice(1).join('_');
        if (suffix && !idVariants.includes(suffix)) idVariants.push(suffix);
    }

    const queryVariants = [
        { current_count: String(MESSAGE_CURRENT_COUNT) },
        { current_count: '0' },
        {},
    ];

    let lastData = { messages: [] };
    let lastError = null;

    for (const convId of idVariants) {
        for (const params of queryVariants) {
            const url = new URL(
                `${PANCAKE_API_BASE}/pages/${encodeURIComponent(pageId)}/conversations/${encodeURIComponent(convId)}/messages`
            );
            url.searchParams.set('page_access_token', token);
            for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

            try {
                const res = await fetch(url.toString(), {
                    method: 'GET',
                    headers: { Accept: 'application/json' },
                });

                if (res.status === 429) {
                    await sleep(1200);
                    continue;
                }
                if (!res.ok) {
                    lastError = new Error(`Pancake messages HTTP ${res.status}`);
                    continue;
                }

                const data = await res.json();
                lastData = data;
                const messages = normalizeMessagesPayload(data);
                if (messages.length > 0) {
                    return { ...data, __usedConversationId: convId, __messageCount: messages.length };
                }
            } catch (err) {
                lastError = err;
            }
        }
    }

    if (lastError && !lastData) throw lastError;
    return lastData;
}

/**
 * Lời chào shop/Botcake — KHÔNG phải địa chỉ khách.
 * Ví dụ: "Em chào Vũ Linh ạ, em thấy a/c cần mua vòng dâu..."
 * Lưu ý: không dùng \b với tiếng Việt (JS \b chỉ ASCII → lệch với "chào").
 */
function isBotcakeGreetingAddress(address) {
    const text = String(address || '').trim();
    if (!text) return false;
    if (/^\[Botcake\]/i.test(text)) return true;

    // Greeting tự động kiểu: "Dạ, e chào X, em vừa nhận/inbox/ib a/c rồi"
    if (/^dạ,?\s*e\s+chào/i.test(text) && /(vừa\s+(nhận|inbox|ib)|a\/c\s+rồi)/i.test(text)) {
        return true;
    }

    // Botcake / script chào bán hàng (không có địa chỉ)
    const isGreetingOpen = /^(em|e|dạ|da)[\s,]+(chào|chao)\b/i.test(text)
        || /^(em|e|dạ|da)[\s,]+(chào|chao)/i.test(text)
        || /^em\s+chào/i.test(text)
        || /em\s+thấy\s+a\/c\s+cần\s+mua/i.test(text);
    const isPitch = /(cần\s+mua|tham\s+khảo|gửi\s+(a\/c|ac|anh|chị)|các\s+mẫu|mau\s+v[àa]\s+gi[áa]|bao\s+nhiêu\s+kg|không\s+biết\s+(chị|a\/c|ac))/i.test(text);
    const hasRealAddress = /(địa\s*chỉ|dia\s*chi|\bxã\b|\bxa\b|phường|phuong|huyện|huyen|tỉnh|tinh\b|ấp\b|\bap\b|đường|duong|thôn|thon)/i.test(text)
        || /\d{1,4}\/\d{1,4}/.test(text); // số nhà kiểu 12/3

    if (isGreetingOpen && isPitch && !hasRealAddress) return true;
    if (isGreetingOpen && !hasRealAddress && text.length > 40) return true;

    return false;
}

function isNoisePendingAddress(address) {
    const text = String(address || '').trim();
    if (!text) return true;
    if (isBotcakeGreetingAddress(text)) return true;
    if (/^SĐT từ Pancake:/i.test(text)) return true;
    // Chỉ có SĐT / tên — chưa có địa chỉ khách gửi
    if (/^SĐT từ (Pancake|list):/i.test(text)) return true;
    return false;
}

/** Địa chỉ đủ tin cậy để tạo pending (không phải greeting / snippet yếu). */
function isStrongCustomerAddress(address, phones = []) {
    const text = String(address || '').trim();
    if (!text || isNoisePendingAddress(text) || isWeakSnippetOnly(text)) return false;
    if (isBotcakeGreetingAddress(text)) return false;

    // Có SĐT trong text + phần còn lại giống địa chỉ
    const withoutPhone = text.replace(PHONE_IN_TEXT_RE, ' ').replace(/\s+/g, ' ').trim();
    if (/(địa\s*chỉ|dia\s*chi|\bxã\b|\bxa\b|phường|phuong|huyện|huyen|tỉnh|tinh\b|ấp\b|\bap\b|đường|duong)/i.test(text)) {
        return withoutPhone.length >= 8;
    }
    if (phones.some((p) => text.includes(p)) && withoutPhone.split(/\s+/).length >= 4) {
        return /(khu|phuong|phường|quan|quận|huyen|huyện|tinh|tỉnh|tp|duong|đường|,)/i.test(withoutPhone)
            || withoutPhone.split(/\s+/).length >= 5;
    }
    return isLikelyOrderIntentSnippet(text, phones) && !isBotcakeGreetingAddress(text)
        && /(khu|phuong|phường|quan|quận|huyen|huyện|tinh|tỉnh|tp|duong|đường|dia chi|địa chỉ|,)/i.test(text);
}

function isWeakSnippetOnly(address) {
    const text = String(address || '').trim();
    return /^\[(sticker|image|video|file|audio|attachment|\d+\s*photos?)\]$/i.test(text);
}

function isFalsePositivePhone(phone, pageId = '') {
    if (!/^0[35789]\d{8}$/.test(phone)) return true;
    const page = String(pageId || '');
    if (!page) return false;
    const bare = phone.replace(/^0/, '');
    // Số nằm trong page_id (vd. 110320872114024 → 0320872114)
    return page.includes(phone) || page.includes(bare);
}

function collectPhonesFromValue(value, intoSet, depth = 0) {
    if (value == null || depth > 6) return;
    if (typeof value === 'string' || typeof value === 'number') {
        extractPhonesFromText(String(value), intoSet);
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) collectPhonesFromValue(item, intoSet, depth + 1);
        return;
    }
    if (typeof value === 'object') {
        // Chỉ lấy field liên quan tin nhắn / SĐT — tránh page_id và metadata
        const preferKeys = [
            'original_message', 'message', 'text', 'snippet', 'content', 'body',
            'phone_number', 'phone', 'mobile', 'recent_phone_numbers', 'phone_numbers',
            'customers', 'customer', 'page_customer', 'from', 'sender', 'psid',
        ];
        for (const key of preferKeys) {
            if (key in value) collectPhonesFromValue(value[key], intoSet, depth + 1);
        }
        // Quét thêm object khách hàng lồng nhau
        for (const key of ['customers', 'customer', 'page_customer', 'from', 'sender']) {
            if (value[key] && typeof value[key] === 'object') {
                collectPhonesFromValue(value[key], intoSet, depth + 1);
            }
        }
        // Nếu object là message-like, quét thêm một số field lồng
        if (value.from || value.sender || value.type || value.attachments) {
            for (const [k, v] of Object.entries(value)) {
                if (preferKeys.includes(k)) continue;
                if (/id|token|page|url|avatar|photo|image/i.test(k)) continue;
                if (typeof v === 'string' && v.length < 300) collectPhonesFromValue(v, intoSet, depth + 1);
            }
        }
    }
}

function normalizeMessagesPayload(data) {
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.messages)) return data.messages;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.conversation?.messages)) return data.conversation.messages;
    if (Array.isArray(data.wrapped?.messages)) return data.wrapped.messages;
    if (Array.isArray(data.messages?.data)) return data.messages.data;
    if (Array.isArray(data.messages?.messages)) return data.messages.messages;
    return [];
}

async function enrichConversationPhonesFromMessages(pageId, token, conv, phoneInfo, stats) {
    const conversationId = String(conv?.id || '').trim();
    if (!conversationId) return phoneInfo;
    if ((stats.messageLookups || 0) >= MAX_MESSAGE_LOOKUPS) {
        stats.messageLookupSkipped = (stats.messageLookupSkipped || 0) + 1;
        return phoneInfo;
    }

    stats.messageLookups = (stats.messageLookups || 0) + 1;
    await sleep(REQUEST_GAP_MS);

    try {
        const data = await fetchRecentMessages(pageId, token, conversationId);
        const messages = normalizeMessagesPayload(data);
        const extracted = extractPhonesAndAddressFromMessages(messages);

        // Fallback có kiểm soát: field tin nhắn/SĐT/customer — tránh stringify cả response
        if (!extracted.phones.length) {
            const safePhones = new Set();
            collectPhonesFromValue(data, safePhones);
            collectPhonesFromValue(data?.customers, safePhones);
            collectPhonesFromValue(data?.conversation, safePhones);
            collectPhonesFromValue(messages, safePhones);

            // Chỉ scrub JSON khi có tin đánh dấu has_phone (tránh bắt số từ Botcake greeting)
            const anyMsgHasPhone = messages.some((m) => m?.has_phone === true || m?.has_phone === 1);
            if (anyMsgHasPhone) {
                try {
                    const scrubbed = JSON.parse(JSON.stringify(data, (key, value) => {
                        if (/^(page_id|conversation_id|id|access_token|page_access_token|avatar|url|photo)$/i.test(String(key))) {
                            return undefined;
                        }
                        return value;
                    }));
                    extractPhonesFromText(JSON.stringify(scrubbed), safePhones);
                } catch (_) { /* ignore */ }
            }

            for (const phone of safePhones) {
                if (!isFalsePositivePhone(phone, pageId)) extracted.phones.push(phone);
            }
        } else {
            extracted.phones = extracted.phones.filter((p) => !isFalsePositivePhone(p, pageId));
        }

        if (!extracted.phones.length) {
            stats.messageLookupEmpty = (stats.messageLookupEmpty || 0) + 1;
            const samples = messages.slice(0, 6).map((m) => {
                const rich = m?.rich_message;
                return {
                    has_phone: m?.has_phone ?? null,
                    type: m?.type ?? null,
                    messageType: typeof m?.message,
                    messageRaw: typeof m?.message === 'string' ? String(m.message).slice(0, 180) : null,
                    messageKeys: m?.message && typeof m.message === 'object' ? Object.keys(m.message).slice(0, 15) : null,
                    richType: rich == null ? null : typeof rich,
                    richKeys: rich && typeof rich === 'object' ? Object.keys(rich).slice(0, 15) : null,
                    richPreview: typeof rich === 'string' ? rich.slice(0, 180) : null,
                    attachmentCount: Array.isArray(m?.attachments) ? m.attachments.length : 0,
                    attachment0Keys: Array.isArray(m?.attachments) && m.attachments[0] && typeof m.attachments[0] === 'object'
                        ? Object.keys(m.attachments[0]).slice(0, 15)
                        : null,
                    fromKeys: m?.from && typeof m.from === 'object' ? Object.keys(m.from).slice(0, 15) : null,
                };
            });
            return {
                ...phoneInfo,
                needsMessageLookup: false,
                messageCount: messages.length,
                messageSampleKeys: messages[0] ? Object.keys(messages[0]).slice(0, 25) : [],
                responseKeys: Object.keys(data || {}).slice(0, 25),
                usedConversationId: data?.__usedConversationId || conversationId,
                sampleHasPhone: samples,
                sampleHasPhoneJson: JSON.stringify(samples).slice(0, 3500),
            };
        }

        const merged = new Set([
            ...(phoneInfo.phones || []).filter((p) => !isFalsePositivePhone(p, pageId)),
            ...extracted.phones,
        ]);
        return {
            ...phoneInfo,
            phones: [...merged],
            apiPhones: [...new Set([...(phoneInfo.apiPhones || []), ...extracted.phones])],
            hasApiPhones: true,
            needsMessageLookup: false,
            addressFromMessages: extracted.address || '',
            messageCount: messages.length,
        };
    } catch (err) {
        console.warn('[pancake-sync] message lookup failed:', conversationId, err?.message || err);
        stats.errors += 1;
        return { ...phoneInfo, needsMessageLookup: false, lookupError: err?.message || String(err) };
    }
}

/**
 * Preload:
 * - unshippedByPhone: còn đơn chưa gửi
 * - lastShippedByPhone: lần gửi hàng gần nhất (để so với intent + grace)
 */
async function loadOrderStateMaps(env) {
    const now = Date.now();
    // Lấy shipped rộng hơn grace để so sánh intent_after_ship (lookback sync ~48h + 7 ngày)
    const shippedLookback = now - Math.max(POST_SHIP_GRACE_MS, LOOKBACK_HOURS * 3600 * 1000) - (7 * 24 * 60 * 60 * 1000);

    const [unshipped, shipped] = await Promise.all([
        env.DB.prepare(`
            SELECT customer_phone, id, order_id, created_at_unix, shipped_at_unix, status
            FROM orders
            WHERE LOWER(TRIM(status)) IN ('pending', 'processing', 'send_later', 'awaiting_reship')
            ORDER BY created_at_unix DESC
            LIMIT 500
        `).all(),
        env.DB.prepare(`
            SELECT customer_phone, id, order_id, created_at_unix, shipped_at_unix, status
            FROM orders
            WHERE shipped_at_unix IS NOT NULL
              AND shipped_at_unix >= ?
            ORDER BY shipped_at_unix DESC
            LIMIT 1000
        `).bind(shippedLookback).all(),
    ]);

    const unshippedByPhone = new Map();
    const lastShippedByPhone = new Map();

    for (const row of unshipped?.results || []) {
        const phone = normalizeOrderPhone(row.customer_phone);
        if (!/^0\d{8,10}$/.test(phone)) continue;
        if (!unshippedByPhone.has(phone)) unshippedByPhone.set(phone, row);
    }

    for (const row of shipped?.results || []) {
        const phone = normalizeOrderPhone(row.customer_phone);
        if (!/^0\d{8,10}$/.test(phone)) continue;
        const prev = lastShippedByPhone.get(phone);
        if (!prev || Number(row.shipped_at_unix || 0) > Number(prev.shipped_at_unix || 0)) {
            lastShippedByPhone.set(phone, row);
        }
    }

    return { unshippedByPhone, lastShippedByPhone };
}

function phoneSavedDecision(unshippedByPhone, lastShippedByPhone, phone, intentAtMs, now) {
    return evaluatePhoneSavedState(
        unshippedByPhone.get(phone) || null,
        lastShippedByPhone.get(phone) || null,
        intentAtMs,
        now
    );
}

async function cleanupFalsePositivePendings(env, pageId, stats) {
    try {
        const { results } = await env.DB.prepare(`
            SELECT id, customer_phone, address, source, updated_at_unix
            FROM pending_unsaved_orders
            WHERE status = ?
            ORDER BY id DESC
            LIMIT 100
        `).bind(OPEN_STATUS).all();

        let cleaned = 0;
        const now = Date.now();
        for (const row of results || []) {
            const phone = normalizeOrderPhone(row.customer_phone);
            // Chỉ dọn: SĐT giả (page_id) hoặc greeting Botcake / địa chỉ nhiễu
            // Giữ pending dù tin cuối là [Photos] nếu SĐT hợp lệ + địa chỉ thật (case Linh Huỳnh)
            const address = String(row.address || '');
            if (
                !isFalsePositivePhone(phone, pageId)
                && !isBotcakeGreetingAddress(address)
                && !isNoisePendingAddress(address)
            ) continue;
            // Backdate updated_at để không dính dismiss cooldown 24h (đây là dọn nhiễu hệ thống, không phải user bấm ×)
            const backdated = now - DISMISS_COOLDOWN_MS - 60_000;
            await env.DB.prepare(`
                UPDATE pending_unsaved_orders
                SET status = ?, updated_at_unix = ?, resolved_at_unix = ?
                WHERE id = ? AND status = ?
            `).bind(DISMISSED_STATUS, backdated, backdated, row.id, OPEN_STATUS).run();
            cleaned += 1;
        }
        stats.falsePositiveCleaned = cleaned;
    } catch (err) {
        console.warn('[pancake-sync] cleanup false positives failed:', err?.message || err);
    }
}

async function resolveOpenPendingForPhone(env, phone, orderMeta = {}) {
    const now = Date.now();
    await env.DB.prepare(`
        UPDATE pending_unsaved_orders
        SET status = ?,
            resolved_order_db_id = ?,
            resolved_order_code = ?,
            resolved_at_unix = ?,
            updated_at_unix = ?
        WHERE customer_phone = ? AND status = ?
    `).bind(
        RESOLVED_STATUS,
        orderMeta.id ?? null,
        orderMeta.order_id ?? null,
        now,
        now,
        phone,
        OPEN_STATUS
    ).run();
}

/**
 * Dọn pending open khi SĐT đã lưu (unshipped / recent ship không có tin mới).
 * Với phone chưa có trong preload: query bổ sung tối đa 30.
 */
async function resolveStaleOpenPendings(env, pendingIndex, unshippedByPhone, lastShippedByPhone, stats) {
    const openPhones = [...pendingIndex.openByPhone.keys()];
    if (!openPhones.length) return;

    const now = Date.now();
    const missing = openPhones.filter(
        (p) => !unshippedByPhone.has(p) && !lastShippedByPhone.has(p)
    ).slice(0, 30);

    for (const phone of missing) {
        try {
            const [unshipped, shipped] = await Promise.all([
                env.DB.prepare(`
                    SELECT id, order_id, created_at_unix, shipped_at_unix, status, customer_phone
                    FROM orders
                    WHERE customer_phone = ?
                      AND LOWER(TRIM(status)) IN ('pending', 'processing', 'send_later', 'awaiting_reship')
                    ORDER BY created_at_unix DESC
                    LIMIT 1
                `).bind(phone).first(),
                env.DB.prepare(`
                    SELECT id, order_id, created_at_unix, shipped_at_unix, status, customer_phone
                    FROM orders
                    WHERE customer_phone = ?
                      AND shipped_at_unix IS NOT NULL
                      AND shipped_at_unix > 0
                    ORDER BY shipped_at_unix DESC
                    LIMIT 1
                `).bind(phone).first(),
            ]);
            if (unshipped) unshippedByPhone.set(phone, unshipped);
            if (shipped) lastShippedByPhone.set(phone, shipped);
        } catch (err) {
            console.warn('[pancake-sync] phone order lookup failed:', phone, err?.message || err);
            stats.errors += 1;
        }
    }

    for (const phone of openPhones) {
        // Không có mốc intent từ Pancake khi dọn stale → chỉ resolve nếu unshipped hoặc trong grace sau ship
        const decision = phoneSavedDecision(unshippedByPhone, lastShippedByPhone, phone, null, now);
        if (!decision.saved) continue;
        try {
            await resolveOpenPendingForPhone(env, phone, decision.matchedOrder || {});
            pendingIndex.openByPhone.delete(phone);
            const latest = pendingIndex.latestByPhone.get(phone);
            if (latest) latest.status = RESOLVED_STATUS;
            stats.alreadyOrdered += 1;
        } catch (err) {
            console.warn('[pancake-sync] resolve stale pending failed:', phone, err?.message || err);
            stats.errors += 1;
        }
    }
}

async function loadPendingIndex(env) {
    const { results } = await env.DB.prepare(`
        SELECT id, customer_phone, status, updated_at_unix, conversation_key, customer_name, address
        FROM pending_unsaved_orders
        ORDER BY id DESC
        LIMIT 300
    `).all();

    const openByPhone = new Map();
    const latestByPhone = new Map();
    const now = Date.now();

    for (const row of results || []) {
        const phone = normalizeOrderPhone(row.customer_phone);
        if (!phone) continue;
        if (!latestByPhone.has(phone)) latestByPhone.set(phone, row);
        if (row.status === OPEN_STATUS && !openByPhone.has(phone)) {
            openByPhone.set(phone, row);
        }
    }

    return { openByPhone, latestByPhone, now };
}

function isRecentlyDismissed(latest, now) {
    return latest
        && latest.status === DISMISSED_STATUS
        && (now - Number(latest.updated_at_unix || 0)) < DISMISS_COOLDOWN_MS;
}

/**
 * Upsert nhẹ: tối đa 1–2 query Turso / SĐT (đã preload index).
 */
async function leanUpsertFromPancake(env, item, index) {
    const { phone, name, conversationKey, address, forceReopen = false } = item;
    const now = Date.now();
    const open = index.openByPhone.get(phone);
    const latest = index.latestByPhone.get(phone);

    // forceReopen: SĐT lấy được từ messages (case chưa mở box) → bỏ cooldown dismiss hệ thống
    if (!forceReopen && isRecentlyDismissed(latest, now) && !open) {
        return 'dismissed';
    }

    if (open) {
        await env.DB.prepare(`
            UPDATE pending_unsaved_orders
            SET customer_name = COALESCE(?, customer_name),
                conversation_key = COALESCE(?, conversation_key),
                address = COALESCE(?, address),
                source = 'pancake-api',
                updated_at_unix = ?
            WHERE id = ?
        `).bind(
            name || null,
            conversationKey || null,
            address || null,
            now,
            open.id
        ).run();
        return 'updated';
    }

    if (latest) {
        await env.DB.prepare(`
            UPDATE pending_unsaved_orders
            SET customer_name = COALESCE(?, customer_name),
                conversation_key = COALESCE(?, conversation_key),
                address = COALESCE(?, address),
                source = 'pancake-api',
                status = ?,
                resolved_order_db_id = NULL,
                resolved_order_code = NULL,
                resolved_at_unix = NULL,
                updated_at_unix = ?
            WHERE id = ?
        `).bind(
            name || null,
            conversationKey || null,
            address || null,
            OPEN_STATUS,
            now,
            latest.id
        ).run();
        index.openByPhone.set(phone, { ...latest, status: OPEN_STATUS, id: latest.id });
        return 'reopened';
    }

    const insert = await env.DB.prepare(`
        INSERT INTO pending_unsaved_orders (
            customer_phone, customer_name, conversation_key, address,
            source, status, created_at_unix, updated_at_unix
        ) VALUES (?, ?, ?, ?, 'pancake-api', ?, ?, ?)
    `).bind(
        phone,
        name || null,
        conversationKey || null,
        address || null,
        OPEN_STATUS,
        now,
        now
    ).run();

    index.openByPhone.set(phone, { id: insert.meta.last_row_id, customer_phone: phone, status: OPEN_STATUS });
    index.latestByPhone.set(phone, { id: insert.meta.last_row_id, customer_phone: phone, status: OPEN_STATUS });
    return 'inserted';
}

async function queueConversationPhones({
    conv,
    phoneInfo,
    now,
    seenPhones,
    toUpsert,
    unshippedByPhone,
    lastShippedByPhone,
    pendingIndex,
    stats,
    env,
    debugTrace = null,
}) {
    if (!phoneInfo?.phones?.length) return;

    const snippet = String(conv.snippet || '').trim().slice(0, 220);
    const addressHint = phoneInfo.addressFromMessages || snippet;
    const snippetLooksLikeOrder = isLikelyOrderIntentSnippet(addressHint, phoneInfo.phones)
        || Boolean(phoneInfo.addressFromMessages);
    stats.withPhone += 1;
    const name = conversationDisplayName(conv);
    const conversationKey = String(conv.id || '');
    const intentAtMs = snippetLooksLikeOrder ? conversationIntentAtMs(conv) : null;

    for (const phone of phoneInfo.phones) {
        if (seenPhones.has(phone)) {
            stats.skipped += 1;
            if (debugTrace) debugTrace.skippedDupPhone = phone;
            continue;
        }
        seenPhones.add(phone);

        const decision = phoneSavedDecision(
            unshippedByPhone,
            lastShippedByPhone,
            phone,
            intentAtMs,
            now
        );

        if (debugTrace) {
            debugTrace.phones = phoneInfo.phones;
            debugTrace.decision = {
                phone,
                saved: decision.saved,
                reason: decision.reason,
                intentAtMs,
                snippetLooksLikeOrder,
                matchedOrderId: decision.matchedOrder?.order_id || null,
                matchedStatus: decision.matchedOrder?.status || null,
            };
        }

        if (decision.saved) {
            stats.alreadyOrdered += 1;
            if (pendingIndex.openByPhone.has(phone)) {
                try {
                    await resolveOpenPendingForPhone(env, phone, decision.matchedOrder || {});
                    pendingIndex.openByPhone.delete(phone);
                } catch (_) { /* ignore */ }
            }
            continue;
        }

        // Bỏ greeting Botcake / pitch bán hàng — tránh pending ảo (case Vũ Linh)
        if (
            isBotcakeGreetingAddress(addressHint)
            || isBotcakeGreetingAddress(phoneInfo.addressFromMessages)
            || isNoisePendingAddress(addressHint)
        ) {
            // Vẫn cho qua nếu đã có địa chỉ khách thật từ messages
            if (!isStrongCustomerAddress(phoneInfo.addressFromMessages, phoneInfo.phones)) {
                stats.skipped += 1;
                if (debugTrace) debugTrace.skippedNoise = true;
                continue;
            }
        }

        const resolvedAddress = isStrongCustomerAddress(phoneInfo.addressFromMessages, phoneInfo.phones)
            ? phoneInfo.addressFromMessages
            : (isStrongCustomerAddress(addressHint, phoneInfo.phones) ? addressHint : '');

        // Không tạo pending chỉ vì có SĐT + lời chào / snippet yếu
        if (!resolvedAddress) {
            stats.skipped += 1;
            if (debugTrace) debugTrace.skippedNoAddress = true;
            continue;
        }

        // Message lookup: cần địa chỉ/chốt đơn thật
        const fromLookup = Boolean(phoneInfo.messageCount > 0 || phoneInfo.addressFromMessages);
        if (fromLookup && !isStrongCustomerAddress(resolvedAddress, phoneInfo.phones)) {
            stats.skipped += 1;
            if (debugTrace) debugTrace.skippedWeakLookup = true;
            continue;
        }

        toUpsert.push({
            phone,
            name,
            conversationKey,
            address: resolvedAddress.slice(0, 220),
            intentAtMs,
            forceReopen: Boolean(
                isStrongCustomerAddress(phoneInfo.addressFromMessages, phoneInfo.phones)
            ),
        });
        if (debugTrace) debugTrace.queued = true;
    }
}

export async function syncPancakeUnsavedOrders(env, options = {}) {
    const { pageId, token, ok } = getPancakeConfig(env);
    if (!ok) {
        return {
            success: false,
            error: 'Thiếu PANCAKE_PAGE_ID hoặc PANCAKE_PAGE_ACCESS_TOKEN',
            scanned: 0,
            withPhone: 0,
            upserted: 0,
            alreadyOrdered: 0,
            dismissed: 0,
            skipped: 0,
        };
    }

    await ensurePendingTable(env);

    const lookbackHours = Number(options.lookbackHours) > 0 ? Number(options.lookbackHours) : LOOKBACK_HOURS;
    const maxPages = Math.min(Number(options.maxPages) > 0 ? Number(options.maxPages) : MAX_PAGES, 3);
    const debugName = String(options.debugName || '').trim().toLowerCase();
    const until = Math.floor(Date.now() / 1000);
    const since = until - Math.round(lookbackHours * 3600);
    const now = Date.now();

    const stats = {
        success: true,
        scanned: 0,
        withPhone: 0,
        upserted: 0,
        alreadyOrdered: 0,
        dismissed: 0,
        skipped: 0,
        errors: 0,
        messageLookups: 0,
        messageLookupEmpty: 0,
        messageLookupSkipped: 0,
        falsePositiveCleaned: 0,
        pageId,
        since,
        until,
        debug: debugName ? null : undefined,
    };

    await cleanupFalsePositivePendings(env, pageId, stats);

    const [{ unshippedByPhone, lastShippedByPhone }, pendingIndex] = await Promise.all([
        loadOrderStateMaps(env),
        loadPendingIndex(env),
    ]);

    await resolveStaleOpenPendings(env, pendingIndex, unshippedByPhone, lastShippedByPhone, stats);

    const seenPhones = new Set();
    const toUpsert = [];
    const pendingMessageLookups = [];

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
        if (pageNumber > 1) await sleep(REQUEST_GAP_MS);

        let data;
        try {
            data = await fetchConversationsPage(pageId, token, since, until, pageNumber);
        } catch (err) {
            console.error('[pancake-sync] fetch page failed:', pageNumber, err?.message || err);
            stats.errors += 1;
            stats.success = false;
            stats.error = err?.message || String(err);
            break;
        }

        if (!data?.success) {
            stats.errors += 1;
            stats.success = false;
            stats.error = data?.message || 'Pancake API success=false';
            break;
        }

        const conversations = Array.isArray(data.conversations) ? data.conversations : [];
        if (conversations.length === 0) break;

        for (const conv of conversations) {
            stats.scanned += 1;
            let phoneInfo = extractPhonesFromConversation(conv);
            const name = conversationDisplayName(conv);
            const isDebugTarget = Boolean(debugName && name.toLowerCase().includes(debugName));
            const debugTrace = isDebugTarget ? {
                name,
                id: conv?.id || null,
                snippet: String(conv?.snippet || '').slice(0, 120),
                has_phone: conv?.has_phone ?? null,
                updated_at: conv?.updated_at ?? conv?.updated_time ?? null,
                updatedAtMs: toMs(conv?.updated_at) || toMs(conv?.updated_time),
                recent_phone_numbers: conv?.recent_phone_numbers || null,
                phoneInfoBefore: {
                    phones: phoneInfo.phones,
                    hasPhoneFlag: phoneInfo.hasPhoneFlag,
                    needsMessageLookup: phoneInfo.needsMessageLookup,
                },
            } : null;

            // Case chưa mở box: chỉ xếp hàng đọc messages khi có tín hiệu thật
            // (tránh quét mọi chat → pending ảo từ Botcake)
            if (!phoneInfo.phones.length) {
                const shouldLookup = needsPhoneMessageLookup(conv, phoneInfo)
                    || Boolean(debugTrace)
                    // Top hội thoại mới: tin cuối không phải sticker thuần
                    || (!isWeakSnippetOnly(String(conv?.snippet || '')) && String(conv?.snippet || '').trim().length >= 8);

                if (shouldLookup) {
                    if (debugTrace) {
                        debugTrace.queuedForLookup = true;
                        stats.debug = debugTrace;
                    }
                    pendingMessageLookups.push({
                        conv,
                        phoneInfo: { ...phoneInfo, needsMessageLookup: true },
                        updatedAt: conversationLookupPriority(conv, phoneInfo) + (debugTrace ? 1e16 : 0),
                        debugTrace,
                    });
                    continue;
                }
                continue;
            }

            if (!shouldConsiderConversation(conv, phoneInfo)) {
                if (!phoneInfo.phones.length) continue;
                stats.skipped += 1;
                if (debugTrace) debugTrace.skippedReason = 'shouldConsider=false';
                continue;
            }

            await queueConversationPhones({
                conv,
                phoneInfo,
                now,
                seenPhones,
                toUpsert,
                unshippedByPhone,
                lastShippedByPhone,
                pendingIndex,
                stats,
                env,
                debugTrace,
            });
        }

        if (conversations.length < 30) break;
    }

    // Ưu tiên hội thoại mới nhất (Linh Huỳnh đang ở đầu list)
    pendingMessageLookups.sort((a, b) => b.updatedAt - a.updatedAt);
    for (const item of pendingMessageLookups.slice(0, MAX_MESSAGE_LOOKUPS)) {
        const enriched = await enrichConversationPhonesFromMessages(
            pageId,
            token,
            item.conv,
            item.phoneInfo,
            stats
        );
        if (item.debugTrace) {
            item.debugTrace.lookupResult = {
                phones: enriched.phones,
                addressFromMessages: enriched.addressFromMessages || '',
                messageCount: enriched.messageCount ?? null,
                messageSampleKeys: enriched.messageSampleKeys || null,
                responseKeys: enriched.responseKeys || null,
                usedConversationId: enriched.usedConversationId || null,
                sampleHasPhone: enriched.sampleHasPhone || null,
                sampleHasPhoneJson: enriched.sampleHasPhoneJson || null,
                lookupError: enriched.lookupError || null,
            };
            stats.debug = item.debugTrace;
        }
        if (!enriched.phones.length) {
            stats.skipped += 1;
            continue;
        }
        await queueConversationPhones({
            conv: item.conv,
            phoneInfo: enriched,
            now,
            seenPhones,
            toUpsert,
            unshippedByPhone,
            lastShippedByPhone,
            pendingIndex,
            stats,
            env,
            debugTrace: item.debugTrace,
        });
    }
    if (pendingMessageLookups.length > MAX_MESSAGE_LOOKUPS) {
        stats.messageLookupSkipped += pendingMessageLookups.length - MAX_MESSAGE_LOOKUPS;
    }

    const MAX_UPSERTS = 25;
    for (const item of toUpsert.slice(0, MAX_UPSERTS)) {
        try {
            const action = await leanUpsertFromPancake(env, item, pendingIndex);
            if (action === 'dismissed') stats.dismissed += 1;
            else if (action === 'updated' || action === 'reopened' || action === 'inserted') stats.upserted += 1;
            else stats.skipped += 1;
        } catch (err) {
            console.warn('[pancake-sync] lean upsert failed:', item.phone, err?.message || err);
            stats.errors += 1;
        }
    }

    if (toUpsert.length > MAX_UPSERTS) {
        stats.skipped += toUpsert.length - MAX_UPSERTS;
    }

    console.log('[pancake-sync] done', stats);
    return stats;
}

export async function handleSyncPancakeUnsaved(env, corsHeaders, options = {}) {
    try {
        const result = await syncPancakeUnsavedOrders(env, options);
        const status = result.success ? 200 : (result.error?.includes('Thiếu') ? 400 : 502);
        return jsonResponse(result, status, corsHeaders);
    } catch (error) {
        console.error('[pancake-sync] handler error:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}
