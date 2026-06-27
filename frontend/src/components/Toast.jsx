// Toast — a transient bottom-center message. Used to explain a hard-blocked
// connection (e.g. a rejected Text -> Number wire). Auto-dismisses after a few
// seconds; reads its message from the store.
import { useEffect } from 'react';
import { useStore } from '../store';

export function Toast() {
  const notice = useStore((s) => s.connectionNotice);
  const dismiss = useStore((s) => s.dismissNotice);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(dismiss, 3500);
    return () => clearTimeout(t);
  }, [notice, dismiss]);

  if (!notice) return null;
  return (
    <div className="vs-toast" role="alert" onClick={dismiss}>
      {notice}
    </div>
  );
}
