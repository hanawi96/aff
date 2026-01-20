-- Migration 050: Add display_name to cost_config
-- Purpose: Allow custom display names for materials independent of item_name
-- Date: 2026-01-20

-- Add display_name column
ALTER TABLE cost_config ADD COLUMN display_name TEXT;

-- Populate display_name with formatted item_name for existing materials
UPDATE cost_config SET display_name = 
    CASE item_name
        WHEN 'bi_bac_s999' THEN 'Bi bạc S999'
        WHEN 'ho_phach_vang' THEN 'Hổ phách vàng'
        WHEN 'ho_phach_nau' THEN 'Hổ phách nâu'
        WHEN 'da_do' THEN 'Đá đỏ'
        WHEN 'da_xanh' THEN 'Đá xanh'
        WHEN 'day_tron' THEN 'Dây trơn'
        WHEN 'day_ngu_sac' THEN 'Dây ngũ sắc'
        WHEN 'day_vang' THEN 'Dây vàng'
        WHEN 'charm_ran' THEN 'Charm rắn'
        WHEN 'charm_rong' THEN 'Charm rồng'
        WHEN 'charm_hoa_sen' THEN 'Charm hoa sen'
        WHEN 'charm_co_4_la' THEN 'Charm cỏ 4 lá'
        WHEN 'chuong' THEN 'Chuông'
        WHEN 'the_ten_tron' THEN 'Thẻ tên tròn'
        WHEN 'the_hinh_ran' THEN 'Thẻ hình rắn'
        WHEN 'thanh_gia' THEN 'Thanh giá'
        WHEN 'bag_red' THEN 'Túi đỏ'
        WHEN 'bag_zip' THEN 'Túi zip'
        WHEN 'box_shipping' THEN 'Hộp vận chuyển'
        WHEN 'customer_shipping_fee' THEN 'Phí ship khách'
        WHEN 'default_shipping_cost' THEN 'Chi phí ship mặc định'
        WHEN 'labor_cost' THEN 'Chi phí nhân công'
        WHEN 'paper_print' THEN 'Giấy in'
        WHEN 'red_string' THEN 'Dây đỏ'
        WHEN 'tax_rate' THEN 'Thuế suất'
        WHEN 'thank_card' THEN 'Thiệp cảm ơn'
        ELSE REPLACE(REPLACE(UPPER(SUBSTR(item_name, 1, 1)) || SUBSTR(item_name, 2), '_', ' '), '  ', ' ')
    END
WHERE display_name IS NULL;
