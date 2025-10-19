import { hello } from "@systemcraft/lib-one";

export const greet = () => {
  const result = sumTwoNumbers(1, 2);
  return `Lib-two says: ${hello()}, your magic number is ${result}`;
};

const sumTwoNumbers = (a: number, b: number) => {
  return a + b;
};
