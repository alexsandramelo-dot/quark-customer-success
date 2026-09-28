export type LocalFileLike = { name: string; webkitRelativePath?: string };
const supported = /\.(csv|xlsx|xls)$/i;
const temporary = /^~\$/u;

export function classifyIndicatorFiles<T extends LocalFileLike>(files: T[]) {
  const recognized = files.filter((file) => supported.test(file.name) && !temporary.test(file.name));
  const ignored = files.filter((file) => !supported.test(file.name) || temporary.test(file.name));
  return { recognized, ignored };
}
