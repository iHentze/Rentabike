import { createContext, useContext, useRef, type ReactNode } from 'react';
import { PToast } from '@porsche-design-system/components-react';

type ToastState = 'info' | 'success';

interface ToastElement extends HTMLElement {
  addMessage: (msg: { text: string; state?: ToastState }) => void;
}

interface ToastContextValue {
  addMessage: (text: string, state?: ToastState) => void;
}

const ToastContext = createContext<ToastContextValue>({
  addMessage: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const toastRef = useRef<ToastElement>(null);

  function addMessage(text: string, state: ToastState = 'info') {
    toastRef.current?.addMessage({ text, state });
  }

  return (
    <ToastContext.Provider value={{ addMessage }}>
      {children}
      <PToast ref={toastRef as React.RefObject<HTMLElement>} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
