import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle, XCircle, Info, Warning } from '@phosphor-icons/react';
import Modal from './Modal.jsx';

const FeedbackCtx = createContext(null);
export const useToast = () => useContext(FeedbackCtx).toast;
export const useConfirm = () => useContext(FeedbackCtx).confirm;

let _id = 0;

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null); // { title, message, confirmText, destructive, resolve }

  const toast = useCallback((message, type = 'success', title) => {
    const id = ++_id;
    setToasts((t) => [...t, { id, message, type, title: title || (type === 'error' ? 'Error' : 'Success') }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  // Returns a promise that resolves true/false.
  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      setDialog({ confirmText: 'Confirm', ...opts, resolve });
    });
  }, []);

  const close = (val) => { dialog?.resolve(val); setDialog(null); };

  const TIcon = { success: CheckCircle, error: XCircle, info: Info };

  return (
    <FeedbackCtx.Provider value={{ toast, confirm }}>
      {children}

      <div className="toast-wrap">
        {toasts.map((t) => {
          const Ic = TIcon[t.type] || Info;
          const color = t.type === 'error' ? '#EF4444' : t.type === 'success' ? '#10B981' : '#2563EB';
          return (
            <div className={`toast ${t.type}`} key={t.id}>
              <Ic size={20} color={color} />
              <div>
                <div className="t-title">{t.title}</div>
                <div className="muted" style={{ fontSize: 13 }}>{t.message}</div>
              </div>
            </div>
          );
        })}
      </div>

      {dialog && (
        <Modal
          title={dialog.title || 'Are you sure?'}
          onClose={() => close(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => close(false)}>Cancel</button>
              <button className={`btn ${dialog.destructive ? 'danger' : 'primary'}`} onClick={() => close(true)}>
                {dialog.confirmText}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Warning size={28} color={dialog.destructive ? '#EF4444' : '#F59E0B'} weight="fill" />
            <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>{dialog.message}</p>
          </div>
        </Modal>
      )}
    </FeedbackCtx.Provider>
  );
}
