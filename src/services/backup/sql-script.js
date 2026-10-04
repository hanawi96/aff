/**
 * Đọc và kiểm tra file backup SQL của shop.
 * Câu lệnh được tách theo dấu ; nằm ngoài chuỗi, ngoài ghi chú và ngoài khối BEGIN/END
 * (thân trigger có dấu ; riêng).
 */

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SKIP_TABLES = new Set(['backup_history', 'backup_lock']);

export function quoteIdent(name) {
    const text = String(name);
    if (!IDENT.test(text)) {
        throw new Error(`Tên không an toàn để ghi vào backup: ${text}`);
    }
    return `"${text}"`;
}

export function sqlLiteral(value, tableName, columnName) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'bigint') {
        throw literalError(tableName, columnName, 'số nguyên quá lớn');
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw literalError(tableName, columnName, 'số không hợp lệ');
        }
        if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
            throw literalError(tableName, columnName, 'số nguyên vượt quá độ chính xác');
        }
        return String(value);
    }
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'object' && value !== null && ArrayBuffer.isView(value) && !(value instanceof DataView)) {
        const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        let hex = '';
        for (let i = 0; i < bytes.length; i++) {
            hex += bytes[i].toString(16).padStart(2, '0');
        }
        return `X'${hex}'`;
    }
    if (typeof value === 'object') {
        throw literalError(tableName, columnName, 'kiểu dữ liệu không xuất được sang SQL');
    }
    return `'${String(value).replace(/'/g, "''")}'`;
}

function literalError(tableName, columnName, reason) {
    const where = tableName ? ` ở ${tableName}.${columnName}` : '';
    return new Error(`Backup dừng${where}: ${reason}`);
}

export function rowToInsertSQL(tableName, row) {
    const columns = Object.keys(row);
    const table = quoteIdent(tableName);
    if (columns.length === 0) {
        return `INSERT INTO ${table} DEFAULT VALUES`;
    }
    const cols = columns.map((column) => quoteIdent(column)).join(', ');
    const values = columns.map((column) => sqlLiteral(row[column], tableName, column)).join(', ');
    return `INSERT INTO ${table} (${cols}) VALUES (${values})`;
}

export function rowcountGuard(table, count) {
    if (!Number.isInteger(count) || count < 0) {
        throw new Error(`Số dòng không hợp lệ ở bảng ${table}`);
    }
    return `INSERT INTO backup_row_verify (n) SELECT CASE WHEN (SELECT COUNT(*) FROM ${quoteIdent(table)}) = ${count} THEN 1 ELSE NULL END`;
}

export async function sha256Hex(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function attachChecksum(body, checksum) {
    return `${body}\n-- CHECKSUM sha256 ${checksum}\n`;
}

export function splitChecksum(sql) {
    const match = String(sql).match(/\r?\n-- CHECKSUM sha256 ([0-9a-f]{64})\s*$/);
    if (!match) return { body: String(sql), checksum: null };
    return { body: sql.slice(0, match.index), checksum: match[1] };
}

export async function verifyChecksum(sql) {
    const split = splitChecksum(sql);
    if (!split.checksum) return { ...split, checksumOk: null };
    const actual = await sha256Hex(split.body);
    return { ...split, checksumOk: actual === split.checksum };
}

function matchWord(sql, index, word) {
    if (index + word.length > sql.length) return false;
    if (sql.slice(index, index + word.length).toUpperCase() !== word) return false;
    const prev = index > 0 ? sql[index - 1] : '';
    const next = sql[index + word.length] || '';
    if (/[A-Za-z0-9_]/.test(prev) || /[A-Za-z0-9_]/.test(next)) return false;
    return true;
}

/**
 * Tách script thành từng câu. Dấu ; trong chuỗi hoặc trong BEGIN/END không phải ranh giới câu.
 * Ghi chú -- và khối được bỏ khi nằm ngoài chuỗi.
 */
export function splitSqlStatements(sql) {
    const statements = [];
    let current = '';
    let inString = false;
    let inLineComment = false;
    let inBlockComment = false;
    let beginDepth = 0;

    for (let i = 0; i < sql.length; i++) {
        const ch = sql[i];
        const next = sql[i + 1];

        if (inLineComment) {
            if (ch === '\n') inLineComment = false;
            continue;
        }
        if (inBlockComment) {
            if (ch === '*' && next === '/') {
                inBlockComment = false;
                i++;
            }
            continue;
        }
        if (inString) {
            current += ch;
            if (ch === "'" && next === "'") {
                current += next;
                i++;
                continue;
            }
            if (ch === "'") inString = false;
            continue;
        }
        if (ch === '-' && next === '-') {
            inLineComment = true;
            i++;
            continue;
        }
        if (ch === '/' && next === '*') {
            inBlockComment = true;
            i++;
            continue;
        }
        if (ch === "'") {
            inString = true;
            current += ch;
            continue;
        }
        if (matchWord(sql, i, 'BEGIN')) {
            beginDepth++;
            current += sql.slice(i, i + 5);
            i += 4;
            continue;
        }
        if (beginDepth > 0 && matchWord(sql, i, 'END')) {
            beginDepth--;
            current += sql.slice(i, i + 3);
            i += 2;
            continue;
        }
        if (ch === ';' && beginDepth === 0) {
            const statement = current.trim();
            if (statement) statements.push(statement);
            current = '';
            continue;
        }
        current += ch;
    }

    if (inBlockComment) {
        throw new Error('File SQL bị cụt: còn ghi chú chưa đóng');
    }
    if (inString) {
        throw new Error('File SQL bị cụt: còn chuỗi chưa đóng');
    }
    if (beginDepth !== 0) {
        throw new Error('File SQL bị cụt: khối BEGIN/END chưa đóng');
    }
    const tail = current.trim();
    if (tail) statements.push(tail);
    return statements;
}

function isForeignKeyPragma(statement) {
    return /^PRAGMA\s+foreign_keys\s*=\s*(OFF|ON|0|1)\s*$/i.test(statement.trim());
}

function skipSpace(text, index) {
    while (index < text.length && /\s/.test(text[index])) index++;
    return index;
}

function readIdent(text, index) {
    index = skipSpace(text, index);
    if (text[index] === '"') {
        let name = '';
        let cursor = index + 1;
        while (cursor < text.length) {
            if (text[cursor] === '"' && text[cursor + 1] === '"') {
                name += '"';
                cursor += 2;
                continue;
            }
            if (text[cursor] === '"') return { name, next: cursor + 1 };
            name += text[cursor];
            cursor++;
        }
        return null;
    }
    const match = text.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (!match) return null;
    return { name: match[0], next: index + match[0].length };
}

function consumeKeyword(text, index, keyword) {
    index = skipSpace(text, index);
    if (text.slice(index, index + keyword.length).toUpperCase() !== keyword) return null;
    const next = text[index + keyword.length] || '';
    if (/[A-Za-z0-9_]/.test(next)) return null;
    return index + keyword.length;
}

function consumeIfNotExists(text, index) {
    const ifAt = consumeKeyword(text, index, 'IF');
    if (ifAt == null) return index;
    const notAt = consumeKeyword(text, ifAt, 'NOT');
    if (notAt == null) return null;
    const existsAt = consumeKeyword(text, notAt, 'EXISTS');
    if (existsAt == null) return null;
    return existsAt;
}

/**
 * Nhận diện câu backup được phép và bảng nó tác động.
 * Trả về null nếu câu không thuộc định dạng backup của shop.
 */
export function classifyStatement(statement) {
    const text = statement.trim();
    let index = 0;

    const drop = consumeKeyword(text, index, 'DROP');
    if (drop != null) {
        index = consumeKeyword(text, drop, 'TABLE');
        if (index == null) return null;
        index = consumeKeyword(text, index, 'IF');
        if (index == null) return null;
        index = consumeKeyword(text, index, 'EXISTS');
        if (index == null) return null;
        const ident = readIdent(text, index);
        if (!ident || skipSpace(text, ident.next) !== text.length) return null;
        return { kind: 'drop', table: ident.name };
    }

    const insert = consumeKeyword(text, index, 'INSERT');
    if (insert != null) {
        index = consumeKeyword(text, insert, 'INTO');
        if (index == null) return null;
        const ident = readIdent(text, index);
        if (!ident) return null;
        return { kind: 'insert', table: ident.name };
    }

    const create = consumeKeyword(text, index, 'CREATE');
    if (create == null) return null;
    index = create;

    const virtualAt = consumeKeyword(text, index, 'VIRTUAL');
    if (virtualAt != null) index = virtualAt;

    const uniqueAt = consumeKeyword(text, index, 'UNIQUE');
    if (uniqueAt != null) index = uniqueAt;

    const kindWordAt = skipSpace(text, index);
    const kindWord = text.slice(kindWordAt).match(/^[A-Za-z]+/);
    if (!kindWord) return null;
    const keyword = kindWord[0].toUpperCase();
    index = kindWordAt + kindWord[0].length;

    if (keyword === 'TABLE') {
        index = consumeIfNotExists(text, index);
        if (index == null) return null;
        const ident = readIdent(text, index);
        if (!ident) return null;
        return { kind: 'create-table', table: ident.name };
    }

    if (keyword === 'INDEX') {
        index = consumeIfNotExists(text, index);
        if (index == null) return null;
        const indexName = readIdent(text, index);
        if (!indexName) return null;
        index = consumeKeyword(text, indexName.next, 'ON');
        if (index == null) return null;
        const table = readIdent(text, index);
        if (!table) return null;
        return { kind: 'index', table: table.name };
    }

    if (keyword === 'TRIGGER') {
        index = consumeIfNotExists(text, index);
        if (index == null) return null;
        const onAt = text.toUpperCase().search(/\bON\b/);
        if (onAt < 0) return null;
        const table = readIdent(text, onAt + 2);
        if (!table) return null;
        return { kind: 'trigger', table: table.name };
    }

    if (keyword === 'VIEW') {
        index = consumeIfNotExists(text, index);
        if (index == null) return null;
        const ident = readIdent(text, index);
        if (!ident) return null;
        return { kind: 'view', table: ident.name };
    }

    return null;
}

function commentLinesOutsideStrings(sql) {
    const comments = [];
    let inString = false;
    let lineStart = 0;
    for (let i = 0; i < sql.length; i++) {
        const ch = sql[i];
        const next = sql[i + 1];
        if (inString) {
            if (ch === "'" && next === "'") {
                i++;
                continue;
            }
            if (ch === "'") inString = false;
            continue;
        }
        if (ch === "'") {
            inString = true;
            continue;
        }
        if (ch === '\n') {
            const line = sql.slice(lineStart, i).trim();
            if (line.startsWith('--')) comments.push(line);
            lineStart = i + 1;
        }
    }
    const tail = sql.slice(lineStart).trim();
    if (!inString && tail.startsWith('--')) comments.push(tail);
    return comments;
}

export function parseDeclaredCounts(sql) {
    const comments = commentLinesOutsideStrings(sql);
    const rowcounts = new Map();
    for (const line of comments) {
        const match = line.match(/^-- ROWCOUNT ([A-Za-z_][A-Za-z0-9_]*) (\d+)$/);
        if (match) rowcounts.set(match[1], Number(match[2]));
    }
    if (rowcounts.size > 0) return { format: 'rowcount', counts: rowcounts };

    const legacy = new Map();
    let current = null;
    for (const line of comments) {
        const table = line.match(/^-- Table:\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
        if (table) {
            current = table[1];
            continue;
        }
        if (!current) continue;
        const data = line.match(/^-- Data \((\d+) rows\)\s*$/);
        if (data) {
            legacy.set(current, Number(data[1]));
            current = null;
            continue;
        }
        if (/^-- No data\s*$/.test(line)) {
            legacy.set(current, 0);
            current = null;
        }
    }
    return { format: legacy.size > 0 ? 'legacy' : 'none', counts: legacy };
}

/**
 * Kiểm tra file trước khi ghi. Câu tác động backup_history và backup_lock được bỏ
 * để lần khôi phục không xóa lịch sử backup đang có.
 */
export async function planRestore(sqlText) {
    if (!sqlText || typeof sqlText !== 'string' || !sqlText.trim()) {
        throw new Error('File rỗng hoặc không hợp lệ');
    }
    const checked = await verifyChecksum(sqlText);
    if (checked.checksumOk === false) {
        throw new Error('Mã kiểm tra không khớp. File backup có thể đã bị sửa hoặc tải thiếu.');
    }

    const declared = parseDeclaredCounts(checked.body);
    const rawStatements = splitSqlStatements(checked.body);
    const statements = [];
    const expected = new Map();
    const counts = { tables: 0, rows: 0, indexes: 0, triggers: 0, views: 0, drops: 0 };

    for (const statement of rawStatements) {
        if (isForeignKeyPragma(statement)) continue;
        const classified = classifyStatement(statement);
        if (!classified) {
            const preview = statement.replace(/\s+/g, ' ').slice(0, 80);
            throw new Error(`File chứa câu lệnh không được phép: ${preview}`);
        }
        if (SKIP_TABLES.has(classified.table)) continue;

        statements.push(statement);
        if (classified.kind === 'drop' || classified.kind === 'create-table') {
            if (!expected.has(classified.table)) expected.set(classified.table, 0);
            if (classified.kind === 'drop') counts.drops++;
            if (classified.kind === 'create-table') counts.tables++;
        } else if (classified.kind === 'insert') {
            expected.set(classified.table, (expected.get(classified.table) || 0) + 1);
            counts.rows++;
        } else if (classified.kind === 'index') {
            counts.indexes++;
        } else if (classified.kind === 'trigger') {
            counts.triggers++;
        } else if (classified.kind === 'view') {
            counts.views++;
        }
    }

    if (expected.size === 0) {
        throw new Error('File không có bảng dữ liệu để khôi phục');
    }

    if (declared.format !== 'none') {
        for (const [table, count] of expected) {
            if (!declared.counts.has(table)) {
                throw new Error(`Thiếu số dòng khai báo của bảng ${table}`);
            }
            const declaredCount = declared.counts.get(table);
            if (declaredCount !== count) {
                throw new Error(`Bảng ${table} khai báo ${declaredCount} dòng nhưng file có ${count} lệnh INSERT`);
            }
        }
    }

    const guards = [];
    for (const [table, count] of expected) {
        guards.push(rowcountGuard(table, count));
    }

    return {
        statements,
        guards,
        expected,
        counts,
        checksum: checked.checksumOk === true ? 'ok' : 'missing',
    };
}
