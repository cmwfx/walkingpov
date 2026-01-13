import json

# Read the input JSON file
with open('part_1candidbestpremium_posts.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Filter items that have pixeldrain.com download links
pixeldrain_items = []
for item in data:
    # Check if any download link contains pixeldrain.com
    has_pixeldrain = any(
        'pixeldrain.com' in download.get('link', '').lower()
        for download in item.get('downloads', [])
    )

    if has_pixeldrain:
        pixeldrain_items.append(item)

# Save filtered items to a new JSON file
output_filename = 'pixeldrain_posts.json'
with open(output_filename, 'w', encoding='utf-8') as f:
    json.dump(pixeldrain_items, f, indent='\t', ensure_ascii=False)

print(f"Extracted {len(pixeldrain_items)} items with pixeldrain.com links")
print(f"Saved to {output_filename}")
