declare module '*.txt' {
  const text: string;
  export default text;
}

declare const process: { exitCode?: number; argv: string[] };
