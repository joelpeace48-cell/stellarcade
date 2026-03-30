import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EnvironmentBadge } from '../../../src/components/v1/EnvironmentBadge';

describe('EnvironmentBadge', () => {
  it('renders testnet environment', () => {
    render(<EnvironmentBadge environment="testnet" />);
    const badge = screen.getByTestId('environment-badge');
    expect(badge).toHaveAttribute('data-environment', 'testnet');
    expect(badge).toHaveTextContent('Testnet');
  });

  it('renders mainnet environment', () => {
    render(<EnvironmentBadge environment="mainnet" />);
    const badge = screen.getByTestId('environment-badge');
    expect(badge).toHaveAttribute('data-environment', 'mainnet');
    expect(badge).toHaveTextContent('Mainnet');
  });

  it('renders unsupported environment', () => {
    render(<EnvironmentBadge environment="unsupported" />);
    const badge = screen.getByTestId('environment-badge');
    expect(badge).toHaveAttribute('data-environment', 'unsupported');
    expect(badge).toHaveTextContent('Unsupported');
  });

  it('normalizes "public" to mainnet', () => {
    render(<EnvironmentBadge environment="public" />);
    const badge = screen.getByTestId('environment-badge');
    expect(badge).toHaveAttribute('data-environment', 'mainnet');
    expect(badge).toHaveTextContent('Mainnet');
  });

  it('normalizes "test" to testnet', () => {
    render(<EnvironmentBadge environment="test" />);
    const badge = screen.getByTestId('environment-badge');
    expect(badge).toHaveAttribute('data-environment', 'testnet');
    expect(badge).toHaveTextContent('Testnet');
  });

  it('handles case-insensitive environment strings', () => {
    render(<EnvironmentBadge environment="TESTNET" />);
    const badge = screen.getByTestId('environment-badge');
    expect(badge).toHaveAttribute('data-environment', 'testnet');
  });

  it('uses custom label when provided', () => {
    render(<EnvironmentBadge environment="testnet" label="Development" />);
    expect(screen.getByText('Development')).toBeInTheDocument();
  });

  it('applies size variants', () => {
    const { rerender } = render(<EnvironmentBadge environment="testnet" size="small" />);
    let badge = screen.getByTestId('environment-badge');
    expect(badge).toHaveClass('environment-badge--small');

    rerender(<EnvironmentBadge environment="testnet" size="medium" />);
    badge = screen.getByTestId('environment-badge');
    expect(badge).toHaveClass('environment-badge--medium');

    rerender(<EnvironmentBadge environment="testnet" size="large" />);
    badge = screen.getByTestId('environment-badge');
    expect(badge).toHaveClass('environment-badge--large');
  });

  it('shows icon by default', () => {
    render(<EnvironmentBadge environment="testnet" />);
    const icon = screen.getByTestId('environment-badge').querySelector('.environment-badge__icon');
    expect(icon).toBeInTheDocument();
  });

  it('hides icon when showIcon is false', () => {
    render(<EnvironmentBadge environment="testnet" showIcon={false} />);
    const icon = screen.getByTestId('environment-badge').querySelector('.environment-badge__icon');
    expect(icon).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<EnvironmentBadge environment="testnet" className="custom-class" />);
    const badge = screen.getByTestId('environment-badge');
    expect(badge).toHaveClass('custom-class');
  });

  it('has proper accessibility attributes', () => {
    render(<EnvironmentBadge environment="testnet" />);
    const badge = screen.getByTestId('environment-badge');
    expect(badge).toHaveAttribute('role', 'status');
    expect(badge).toHaveAttribute('aria-label', 'Network environment: Testnet');
  });

  it('handles empty environment string gracefully', () => {
    render(<EnvironmentBadge environment="" />);
    const badge = screen.getByTestId('environment-badge');
    expect(badge).toHaveAttribute('data-environment', 'unsupported');
  });

  it('handles null-like environment values', () => {
    render(<EnvironmentBadge environment={undefined as any} />);
    const badge = screen.getByTestId('environment-badge');
    expect(badge).toHaveAttribute('data-environment', 'unsupported');
  });

  it('uses custom testId', () => {
    render(<EnvironmentBadge environment="testnet" testId="custom-badge" />);
    expect(screen.getByTestId('custom-badge')).toBeInTheDocument();
  });
});
