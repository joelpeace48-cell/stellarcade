
import { fireEvent, render, screen } from '@testing-library/react';
import { AsyncStateBoundary } from '../../../src/components/v1/AsyncStateBoundary';

describe('AsyncStateBoundary', () => {
  it('renders loading branch', () => {
    render(
      <AsyncStateBoundary
        status="loading"
        renderSuccess={() => <div>ok</div>}
      />,
    );

    expect(screen.getByTestId('async-state-boundary-loading')).toBeInTheDocument();
  });

  it('renders error branch and calls retry', () => {
    const onRetry = vi.fn();

    render(
      <AsyncStateBoundary
        status="error"
        error={new Error('boom')}
        onRetry={onRetry}
        renderSuccess={() => <div>ok</div>}
      />,
    );

    fireEvent.click(screen.getByTestId('async-state-boundary-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders empty when success data is null', () => {
    render(
      <AsyncStateBoundary
        status="success"
        data={null}
        renderSuccess={() => <div>ok</div>}
      />,
    );

    expect(screen.getByTestId('async-state-boundary-empty')).toBeInTheDocument();
  });

  it('renders success branch with data', () => {
    render(
      <AsyncStateBoundary
        status="success"
        data={{ id: '1' }}
        renderSuccess={(data) => <div>{data.id}</div>}
      />,
    );

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('uses custom error renderer', () => {
    render(
      <AsyncStateBoundary
        status="error"
        error={new Error('boom')}
        renderError={() => <div>custom</div>}
        renderSuccess={() => <div>ok</div>}
      />,
    );

    expect(screen.getByText('custom')).toBeInTheDocument();
  });
});

describe('AsyncStateBoundary Stale Data', () => {
  it('renders success branch with stale banner when status is error but data exists and showStale is true', () => {
    const data = { id: 'stale-1' };
    render(
      <AsyncStateBoundary
        status="error"
        data={data}
        showStale={true}
        renderSuccess={(d) => <div data-testid="success-content">{d.id}</div>}
      />,
    );

    expect(screen.getByTestId('async-state-boundary-stale-banner')).toBeInTheDocument();
    expect(screen.getByTestId('success-content')).toHaveTextContent('stale-1');
  });

  it('renders success branch with stale banner and retry button', () => {
    const onRetry = vi.fn();
    render(
      <AsyncStateBoundary
        status="error"
        data={{ id: '1' }}
        showStale={true}
        onRetry={onRetry}
        renderSuccess={() => <div>ok</div>}
      />,
    );

    const retryButton = screen.getByTestId('async-state-boundary-stale-retry');
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders error branch when status is error and data exists but showStale is false', () => {
    render(
      <AsyncStateBoundary
        status="error"
        data={{ id: '1' }}
        showStale={false}
        renderSuccess={() => <div>ok</div>}
      />,
    );

    expect(screen.getByTestId('async-state-boundary-error')).toBeInTheDocument();
    expect(screen.queryByTestId('async-state-boundary-stale-banner')).not.toBeInTheDocument();
  });

  it('uses custom stale message', () => {
    render(
      <AsyncStateBoundary
        status="error"
        data={{ id: '1' }}
        showStale={true}
        staleMessage="Custom stale message"
        renderSuccess={() => <div>ok</div>}
      />,
    );

    expect(screen.getByText('Custom stale message')).toBeInTheDocument();
  });
});
