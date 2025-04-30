declare module 'sinon' {
  export interface SinonStub {
    returns(obj: any): SinonStub;
    resolves(obj: any): SinonStub;
    rejects(obj: any): SinonStub;
    callsFake(fn: Function): SinonStub;
    withArgs(...args: any[]): SinonStub;
    onCall(n: number): SinonStub;
    resetHistory(): void;
    calledOnce: boolean;
    calledTwice: boolean;
    calledThrice: boolean;
    called: boolean;
    callCount: number;
  }

  export interface SinonFakeTimers {
    restore(): void;
    tick(ms: number): void;
  }

  export interface SinonStubbedInstance<T> {
    [key: string]: SinonStub;
  }

  export function stub(): SinonStub;
  export function spy(): SinonStub;
  export function mock(): any;
  export function createStubInstance<T>(constructor: Function): SinonStubbedInstance<T>;
  export function useFakeTimers(): SinonFakeTimers;

  export const match: {
    any: () => boolean;
    string: () => boolean;
    number: () => boolean;
    object: () => boolean;
    array: () => boolean;
  };

  export const assert: {
    called: (stub: SinonStub) => void;
    calledWith: (stub: SinonStub, ...args: any[]) => void;
    calledOnce: (stub: SinonStub) => void;
    notCalled: (stub: SinonStub) => void;
  };
}
