import { checkDuplicates } from '@/fetch/polygon/check-duplicates';

// Get filename from command line argument
const filePath = process.argv[2];

if (!filePath) {
  console.error('❌ Error: Please specify a file to check');
  console.log('\nUsage:');
  console.log('  bun run check-duplicates.ts <filename>');
  console.log('\nExample:');
  console.log('  bun run check-duplicates.ts data/SPY_1DAY_2020-10-17_to_2025-10-17.csv');
  process.exit(1);
}

// Run the check
await checkDuplicates(filePath).catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
