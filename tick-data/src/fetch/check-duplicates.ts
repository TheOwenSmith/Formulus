import * as fs from 'fs';
import * as readline from 'readline';

interface DuplicateInfo {
  value: string;
  lines: number[];
  count: number;
}

/**
 * Check for duplicate data in a CSV file
 * Reads line by line for memory efficiency with large files
 */
export async function checkDuplicates(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  // Track timestamps and full rows
  const timestampMap = new Map<string, number[]>(); // timestamp -> line numbers
  const rowMap = new Map<string, number[]>(); // full row hash -> line numbers

  let lineNumber = 0;
  let headerSkipped = false;
  let header = '';

  console.log(`📊 Analyzing file: ${filePath}\n`);

  // Read file line by line
  for await (const line of rl) {
    lineNumber++;

    // Store header
    if (!headerSkipped) {
      header = line;
      headerSkipped = true;
      console.log(`📋 Header: ${header}\n`);
      continue;
    }

    // Skip empty lines
    if (!line.trim()) {
      continue;
    }

    // Parse timestamp (first column)
    const columns = line.split(',');
    if (columns.length > 0) {
      const timestamp = columns[0];

      // Track by timestamp
      if (!timestampMap.has(timestamp)) {
        timestampMap.set(timestamp, []);
      }
      timestampMap.get(timestamp)!.push(lineNumber);

      // Track by full row content
      const rowContent = line.trim();
      if (!rowMap.has(rowContent)) {
        rowMap.set(rowContent, []);
      }
      rowMap.get(rowContent)!.push(lineNumber);
    }
  }

  const totalDataLines = lineNumber - 1; // Subtract header
  console.log(`✅ Read ${totalDataLines} data entries from ${lineNumber} total lines\n`);

  // Find duplicates by timestamp
  console.log('🔍 Checking for duplicate timestamps...');
  const timestampDuplicates: DuplicateInfo[] = [];

  for (const [timestamp, lines] of timestampMap.entries()) {
    if (lines.length > 1) {
      timestampDuplicates.push({
        value: timestamp,
        lines,
        count: lines.length,
      });
    }
  }

  if (timestampDuplicates.length > 0) {
    console.log(`\n⚠️  Found ${timestampDuplicates.length} duplicate timestamps:\n`);

    // Sort by line number for easier reading
    timestampDuplicates.sort((a, b) => a.lines[0] - b.lines[0]);

    for (const dup of timestampDuplicates) {
      console.log(`   ${dup.value}`);
      console.log(`     → appears ${dup.count} times on lines: ${dup.lines.join(', ')}`);
    }
    console.log();
  } else {
    console.log('   ✓ No duplicate timestamps found\n');
  }

  // Find duplicates by full row content
  console.log('🔍 Checking for duplicate rows (exact matches)...');
  const rowDuplicates: DuplicateInfo[] = [];

  for (const [rowContent, lines] of rowMap.entries()) {
    if (lines.length > 1) {
      // Show first 100 chars of the row for readability
      const displayValue =
        rowContent.length > 100 ? rowContent.substring(0, 100) + '...' : rowContent;

      rowDuplicates.push({
        value: displayValue,
        lines,
        count: lines.length,
      });
    }
  }

  if (rowDuplicates.length > 0) {
    console.log(`\n⚠️  Found ${rowDuplicates.length} duplicate rows (exact matches):\n`);

    // Sort by line number for easier reading
    rowDuplicates.sort((a, b) => a.lines[0] - b.lines[0]);

    for (const dup of rowDuplicates) {
      console.log(`   Lines ${dup.lines.join(', ')} (${dup.count} copies):`);
      console.log(`     ${dup.value}`);
      console.log();
    }
  } else {
    console.log('   ✓ No duplicate rows found\n');
  }

  // Summary
  console.log('📈 Summary:');
  console.log(`   Total data entries: ${totalDataLines}`);
  console.log(`   Unique timestamps: ${timestampMap.size}`);
  console.log(`   Unique rows: ${rowMap.size}`);
  console.log(`   Duplicate timestamps: ${timestampDuplicates.length}`);
  console.log(`   Duplicate rows: ${rowDuplicates.length}`);

  if (timestampDuplicates.length > 0 || rowDuplicates.length > 0) {
    console.log('\n⚠️  Duplicates detected - consider cleaning the data');
    process.exit(1);
  } else {
    console.log('\n✅ No duplicates found - data is clean!');
    process.exit(0);
  }
}
