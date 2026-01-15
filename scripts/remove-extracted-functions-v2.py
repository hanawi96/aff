#!/usr/bin/env python3
"""
Script để xóa các hàm đã tách khỏi orders.js
Đọc tất cả file trong orders/ và xóa các function tương ứng khỏi orders.js
"""

import os
import re
from pathlib import Path

# Đường dẫn
ORDERS_DIR = Path("public/assets/js/orders")
ORDERS_JS = Path("public/assets/js/orders.js")

def extract_function_names(file_path):
    """Trích xuất tên các function từ file"""
    functions = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Tìm function declarations: function functionName(...)
    pattern1 = r'function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\('
    functions.extend(re.findall(pattern1, content))
    
    # Tìm async function declarations: async function functionName(...)
    pattern2 = r'async\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\('
    functions.extend(re.findall(pattern2, content))
    
    return list(set(functions))  # Remove duplicates

def find_function_in_orders_js(content, func_name):
    """Tìm vị trí function trong orders.js"""
    # Pattern cho function declaration
    patterns = [
        rf'function\s+{re.escape(func_name)}\s*\([^)]*\)\s*\{{',
        rf'async\s+function\s+{re.escape(func_name)}\s*\([^)]*\)\s*\{{',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, content)
        if match:
            return match.start()
    
    return -1

def extract_function_body(content, start_pos):
    """Trích xuất toàn bộ body của function từ vị trí bắt đầu"""
    brace_count = 0
    in_function = False
    end_pos = start_pos
    
    for i in range(start_pos, len(content)):
        char = content[i]
        
        if char == '{':
            brace_count += 1
            in_function = True
        elif char == '}':
            brace_count -= 1
            
            if in_function and brace_count == 0:
                end_pos = i + 1
                break
    
    return start_pos, end_pos

def remove_function_from_orders_js(content, func_name):
    """Xóa function khỏi orders.js"""
    start_pos = find_function_in_orders_js(content, func_name)
    
    if start_pos == -1:
        return content, False
    
    # Tìm comment phía trước function (nếu có)
    comment_start = start_pos
    lines_before = content[:start_pos].split('\n')
    
    # Kiểm tra các dòng comment phía trước
    for i in range(len(lines_before) - 1, max(0, len(lines_before) - 10), -1):
        line = lines_before[i].strip()
        if line.startswith('//') or line.startswith('/*') or line.startswith('*'):
            comment_start = len('\n'.join(lines_before[:i])) + 1
        elif line == '':
            continue
        else:
            break
    
    # Tìm end của function
    _, end_pos = extract_function_body(content, start_pos)
    
    # Xóa function và comment
    new_content = content[:comment_start] + content[end_pos:]
    
    return new_content, True

def main():
    print("🔍 Đang quét các file đã tách...")
    
    # Đọc tất cả file trong orders/
    extracted_functions = []
    
    for file_path in ORDERS_DIR.glob("*.js"):
        if file_path.name == "orders-main.js":
            continue  # Skip main file
        
        print(f"  📄 Đọc {file_path.name}...")
        functions = extract_function_names(file_path)
        extracted_functions.extend(functions)
        print(f"     Tìm thấy {len(functions)} functions")
    
    print(f"\n✅ Tổng cộng tìm thấy {len(extracted_functions)} functions đã tách")
    print(f"📝 Danh sách: {', '.join(sorted(set(extracted_functions)))}\n")
    
    # Đọc orders.js
    print("📖 Đọc orders.js...")
    with open(ORDERS_JS, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_length = len(content)
    
    # Xóa từng function
    removed_count = 0
    not_found = []
    
    for func_name in sorted(set(extracted_functions)):
        print(f"  🗑️  Đang xóa {func_name}...", end=" ")
        content, removed = remove_function_from_orders_js(content, func_name)
        
        if removed:
            removed_count += 1
            print("✅")
        else:
            not_found.append(func_name)
            print("⚠️  Không tìm thấy")
    
    # Lưu file
    new_length = len(content)
    lines_removed = original_length - new_length
    
    print(f"\n📊 Kết quả:")
    print(f"  ✅ Đã xóa: {removed_count} functions")
    print(f"  ⚠️  Không tìm thấy: {len(not_found)} functions")
    print(f"  📉 Giảm: {lines_removed:,} ký tự")
    
    if not_found:
        print(f"\n⚠️  Các function không tìm thấy:")
        for func in not_found:
            print(f"     - {func}")
    
    # Backup và lưu
    backup_path = ORDERS_JS.with_suffix('.js.backup')
    print(f"\n💾 Tạo backup tại {backup_path}...")
    with open(backup_path, 'w', encoding='utf-8') as f:
        with open(ORDERS_JS, 'r', encoding='utf-8') as original:
            f.write(original.read())
    
    print(f"💾 Lưu orders.js mới...")
    with open(ORDERS_JS, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("\n✅ Hoàn thành!")
    print(f"📝 File gốc đã được backup tại: {backup_path}")

if __name__ == "__main__":
    main()
