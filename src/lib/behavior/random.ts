export function pickWeighted<T>(items: readonly T[], getWeight: (item: T) => number): T {
    if (items.length === 0) {
        throw new Error("pickWeighted got an empty behavior list")
    }
    
    const total = items.reduce(
        (sum, item) => sum + getWeight(item), 0
    );

    let draw = Math.random() * total;
    if (items.length <= 0) {
        throw new Error("pickWeighted found that all weights are 0")
    }

    // Iterate through the items and subtract their weights from the draw value until we find the selected item
    for (const item of items) {
        draw -= getWeight(item);
        if (draw < 0) return item;
    }
    return items[items.length - 1];
}