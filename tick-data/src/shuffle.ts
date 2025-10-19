import * as fs from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createInterface } from 'readline';

/**
 * Shuffles a JSONL file efficiently, capable of handling very large files (10GB+)
 * Uses a multi-pass approach with temporary chunk files to avoid loading entire file into memory
 *
 * @param inputPath - Path to the input JSONL file
 * @param outputPath - Path to the output shuffled JSONL file
 * @param chunkSize - Number of lines per chunk (default: 100000)
 * @returns Promise that resolves when shuffling is complete
 */
export async function shuffleJsonl(
  inputPath: string,
  outputPath: string,
  chunkSize: number = 100000,
): Promise<void> {
  console.log('Starting JSONL shuffle...');

  // Step 1: Count total lines in the file
  console.log('Step 1: Counting lines...');
  const totalLines = await countLines(inputPath);
  console.log(`Total lines: ${totalLines.toLocaleString()}`);

  if (totalLines === 0) {
    throw new Error('Input file is empty');
  }

  // Step 2: Generate shuffled indices
  console.log('Step 2: Generating shuffled indices...');
  const shuffledIndices = generateShuffledIndices(totalLines);
  console.log('Indices shuffled');

  // Step 3: Create temporary directory for chunks
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'jsonl-shuffle-'));
  console.log(`Temporary directory: ${tempDir}`);

  try {
    // Step 4: Read input file and write lines to temporary chunks based on shuffled positions
    console.log('Step 3: Distributing lines to chunks...');
    await distributeToChunks(inputPath, tempDir, shuffledIndices, chunkSize);

    // Step 5: Merge chunks in order to create final shuffled output
    console.log('Step 4: Merging chunks...');
    await mergeChunks(tempDir, outputPath, chunkSize, totalLines);

    console.log('Shuffle complete!');
  } finally {
    // Clean up temporary directory
    console.log('Cleaning up temporary files...');
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Count the number of lines in a file using streaming
 */
async function countLines(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    const stream = createReadStream(filePath);
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    rl.on('line', () => {
      count++;
    });

    rl.on('close', () => {
      resolve(count);
    });

    rl.on('error', reject);
    stream.on('error', reject);
  });
}

/**
 * Generate a shuffled array of indices using Fisher-Yates shuffle
 */
function generateShuffledIndices(length: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);

  // Fisher-Yates shuffle
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices;
}

/**
 * Read input file and distribute lines to chunk files based on their target positions
 */
async function distributeToChunks(
  inputPath: string,
  tempDir: string,
  shuffledIndices: number[],
  chunkSize: number,
): Promise<void> {
  // Create write streams for all chunks
  const numChunks = Math.ceil(shuffledIndices.length / chunkSize);
  const chunkWriters: Array<{ stream: fs.WriteStream; buffer: string[] }> = [];

  for (let i = 0; i < numChunks; i++) {
    const chunkPath = path.join(tempDir, `chunk-${i.toString().padStart(6, '0')}.jsonl`);
    chunkWriters.push({
      stream: createWriteStream(chunkPath),
      buffer: [],
    });
  }

  // Create a mapping of original index -> target position
  const targetPositions = new Array(shuffledIndices.length);
  for (let i = 0; i < shuffledIndices.length; i++) {
    targetPositions[shuffledIndices[i]] = i;
  }

  return new Promise((resolve, reject) => {
    let currentLine = 0;
    const stream = createReadStream(inputPath);
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      const targetPos = targetPositions[currentLine];
      const chunkIndex = Math.floor(targetPos / chunkSize);
      const posInChunk = targetPos % chunkSize;

      // Store line with its position in chunk
      const writer = chunkWriters[chunkIndex];
      writer.buffer.push(JSON.stringify({ pos: posInChunk, line }));

      // Flush buffer if it gets too large (every 1000 lines)
      if (writer.buffer.length >= 1000) {
        writer.stream.write(writer.buffer.join('\n') + '\n');
        writer.buffer = [];
      }

      currentLine++;

      if (currentLine % 100000 === 0) {
        console.log(`  Processed ${currentLine.toLocaleString()} lines...`);
      }
    });

    rl.on('close', async () => {
      try {
        // Flush remaining buffers and close all streams
        for (const writer of chunkWriters) {
          if (writer.buffer.length > 0) {
            writer.stream.write(writer.buffer.join('\n') + '\n');
          }
          writer.stream.end();
        }

        // Wait for all streams to finish
        await Promise.all(
          chunkWriters.map(
            (writer) =>
              new Promise<void>((res, rej) => {
                writer.stream.on('finish', res);
                writer.stream.on('error', rej);
              }),
          ),
        );

        resolve();
      } catch (error) {
        reject(error);
      }
    });

    rl.on('error', reject);
    stream.on('error', reject);
  });
}

/**
 * Merge chunk files in order, sorting lines within each chunk
 */
async function mergeChunks(
  tempDir: string,
  outputPath: string,
  chunkSize: number,
  totalLines: number,
): Promise<void> {
  const outputStream = createWriteStream(outputPath);
  const numChunks = Math.ceil(totalLines / chunkSize);

  for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
    const chunkPath = path.join(tempDir, `chunk-${chunkIndex.toString().padStart(6, '0')}.jsonl`);

    // Check if chunk file exists
    if (!fs.existsSync(chunkPath)) {
      continue;
    }

    // Read chunk, sort by position, and write to output
    const lines: Array<{ pos: number; line: string }> = [];

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(chunkPath);
      const rl = createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      rl.on('line', (line) => {
        if (line.trim()) {
          lines.push(JSON.parse(line));
        }
      });

      rl.on('close', resolve);
      rl.on('error', reject);
      stream.on('error', reject);
    });

    // Sort lines by their position within the chunk
    lines.sort((a, b) => a.pos - b.pos);

    // Write sorted lines to output
    for (const item of lines) {
      outputStream.write(item.line + '\n');
    }

    if ((chunkIndex + 1) % 10 === 0 || chunkIndex === numChunks - 1) {
      console.log(`  Merged ${chunkIndex + 1}/${numChunks} chunks...`);
    }
  }

  return new Promise((resolve, reject) => {
    outputStream.end();
    outputStream.on('finish', resolve);
    outputStream.on('error', reject);
  });
}

/**
 * Utility function to shuffle a JSONL file in place (overwrites the original)
 */
export async function shuffleJsonlInPlace(
  filePath: string,
  chunkSize: number = 100000,
): Promise<void> {
  const tempOutput = `${filePath}.shuffled.tmp`;
  await shuffleJsonl(filePath, tempOutput, chunkSize);
  await fs.promises.rename(tempOutput, filePath);
}

// Example usage
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: bun run shuffle.ts <input.jsonl> <output.jsonl> [chunkSize]');
    console.log('  or: bun run shuffle.ts <file.jsonl> --in-place [chunkSize]');
    process.exit(1);
  }

  const [inputPath, outputPathOrFlag, chunkSizeStr] = args;

  if (outputPathOrFlag === '--in-place') {
    const chunkSize = chunkSizeStr ? parseInt(chunkSizeStr, 10) : 100000;
    shuffleJsonlInPlace(inputPath, chunkSize)
      .then(() => console.log('Done!'))
      .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
      });
  } else {
    const outputPath = outputPathOrFlag;
    const chunkSize = chunkSizeStr ? parseInt(chunkSizeStr, 10) : 100000;
    shuffleJsonl(inputPath, outputPath, chunkSize)
      .then(() => console.log('Done!'))
      .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
      });
  }
}
