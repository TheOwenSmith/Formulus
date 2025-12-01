type ComparisonFn<T> = (a: T, b: T) => number;
export class Heap<T> {
  protected heap: T[] = [];
  constructor(private compFn: ComparisonFn<T>) {}

  // O(1)
  peek(): T | undefined {
    return this.heap[0];
  }

  // O(1)
  get size(): number {
    return this.heap.length;
  }

  // O(log n) | O(1) average
  add(val: T) {
    this.heap.push(val);
    this.bubbleUp(this.size - 1);
  }

  // O(log n) | O(1) average
  pop(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }

    const removed = this.peek()!;
    const bottom = this.heap.pop()!;
    if (this.size > 0) {
      this.heap[0] = bottom;
      this.bubbleDown(0);
    }
    return removed;
  }

  protected bubbleUp(index: number) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compFn(this.heap[parent], this.heap[index]) <= 0) {
        return;
      }

      this.swap(parent, index);
      index = parent;
    }
  }

  protected bubbleDown(index: number) {
    while (true) {
      let smallest = index;
      const left = index * 2 + 1;
      const right = index * 2 + 2;
      if (left < this.size && this.compFn(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < this.size && this.compFn(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }

      if (smallest === index) {
        return;
      }
      this.swap(index, smallest);
      index = smallest;
    }
  }

  protected swap(i: number, j: number) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }
}
