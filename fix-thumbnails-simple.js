// Simple script to fix thumbnail URLs
// Run this with: node fix-thumbnails-simple.js
//
// BEFORE RUNNING: Update the credentials below with your actual Supabase URL and Service Key

import { createClient } from '@supabase/supabase-js';

// ⚠️ UPDATE THESE WITH YOUR ACTUAL CREDENTIALS ⚠️
// You can find these in your .env file or Supabase dashboard
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_KEY_HERE';

// Base URL for your server (where images are hosted)
const BASE_URL = 'http://localhost:3001';

// ============================================

if (SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE' || SUPABASE_SERVICE_KEY === 'YOUR_SERVICE_KEY_HERE') {
  console.error('\n❌ ERROR: Please update the credentials in this script first!\n');
  console.error('Edit fix-thumbnails-simple.js and replace:');
  console.error('  - YOUR_SUPABASE_URL_HERE with your actual Supabase URL');
  console.error('  - YOUR_SERVICE_KEY_HERE with your actual Service Key\n');
  console.error('You can find these values in your .env file or Supabase dashboard.\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixThumbnailUrls() {
  try {
    console.log('\n🔍 Starting to fix thumbnail URLs...\n');

    // Get videos with relative paths
    const { data: videos, error: fetchError } = await supabase
      .from('videos')
      .select('id, title, thumbnail_url')
      .like('thumbnail_url', '/uploads/%');

    if (fetchError) {
      throw fetchError;
    }

    if (!videos || videos.length === 0) {
      console.log('✅ No videos found with relative thumbnail URLs. Nothing to fix!\n');
      return;
    }

    console.log(`📋 Found ${videos.length} video(s) with relative thumbnail URLs:\n`);
    console.log(`🔗 Using base URL: ${BASE_URL}\n`);

    // Fix each video
    let fixed = 0;
    let failed = 0;

    for (const video of videos) {
      const newUrl = `${BASE_URL}${video.thumbnail_url}`;
      
      console.log(`📝 Fixing: "${video.title}"`);
      console.log(`   Old: ${video.thumbnail_url}`);
      console.log(`   New: ${newUrl}`);

      const { error: updateError } = await supabase
        .from('videos')
        .update({ thumbnail_url: newUrl })
        .eq('id', video.id);

      if (updateError) {
        console.error(`   ❌ Failed: ${updateError.message}\n`);
        failed++;
      } else {
        console.log(`   ✅ Fixed\n`);
        fixed++;
      }
    }

    console.log('\n========================================');
    console.log('           SUMMARY');
    console.log('========================================');
    console.log(`Total videos processed: ${videos.length}`);
    console.log(`✅ Successfully fixed:  ${fixed}`);
    console.log(`❌ Failed:              ${failed}`);
    console.log('========================================\n');

    if (fixed > 0) {
      console.log('🎉 Thumbnails should now load correctly on the homepage!');
      console.log('   Refresh your browser to see the changes.\n');
    }

  } catch (error) {
    console.error('\n❌ Error fixing thumbnail URLs:', error.message);
    console.error('\nMake sure:');
    console.error('  1. Your Supabase credentials are correct');
    console.error('  2. Your service key has admin privileges');
    console.error('  3. You have internet connection\n');
    process.exit(1);
  }
}

console.log('\n========================================');
console.log('   VAULTTUBE THUMBNAIL URL FIXER');
console.log('========================================\n');

fixThumbnailUrls();
