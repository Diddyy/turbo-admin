/** A count and its noun, one or many: `plural(1, 'page')` is "1 page", `plural(3, 'page')` "3 pages". */
export const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString()} ${count === 1 ? one : many}`;
