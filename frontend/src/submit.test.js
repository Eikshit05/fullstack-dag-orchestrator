import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SubmitButton } from './submit';
import { useStore } from './store';

describe('SubmitButton — network & event-loop resilience', () => {
  beforeEach(() => {
    useStore.setState({
      nodes: [
        { id: 'a', type: 'customInput', data: {} },
        { id: 'b', type: 'customOutput', data: {} },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
      nodeIDs: {},
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  it('shows the ResultCard as the only feedback (no native alert)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ num_nodes: 2, num_edges: 1, is_dag: true }),
    });
    jest.spyOn(window, 'alert').mockImplementation(() => {});

    render(<SubmitButton />);
    fireEvent.click(screen.getByText('Submit'));

    // The styled card renders with the parse result…
    expect(await screen.findByText('Pipeline Submitted')).toBeInTheDocument();
    expect(screen.getByText('Valid DAG')).toBeInTheDocument();
    // …and no native alert popup fires anymore.
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('degrades gracefully on a backend error (no unhandled rejection, no alert)', async () => {
    const rejections = [];
    const onRejection = (e) => rejections.push(e);
    window.addEventListener('unhandledrejection', onRejection);

    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    jest.spyOn(window, 'alert').mockImplementation(() => {});

    render(<SubmitButton />);
    fireEvent.click(screen.getByText('Submit'));

    // The error is caught and surfaced through the styled card…
    expect(await screen.findByText('Submission Failed')).toBeInTheDocument();
    // …no success alert fires, and nothing escapes as an unhandled rejection.
    expect(window.alert).not.toHaveBeenCalled();
    await waitFor(() => expect(rejections).toHaveLength(0));

    window.removeEventListener('unhandledrejection', onRejection);
  });
});
