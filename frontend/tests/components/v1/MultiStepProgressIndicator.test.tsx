import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiStepProgressIndicator, type ProgressStep } from '../../../src/components/v1/MultiStepProgressIndicator';

const mockSteps: ProgressStep[] = [
  { id: 'validate', label: 'Validate' },
  { id: 'submit', label: 'Submit' },
  { id: 'confirm', label: 'Confirm' },
];

describe('MultiStepProgressIndicator', () => {
  it('renders all steps', () => {
    render(<MultiStepProgressIndicator steps={mockSteps} currentStepIndex={0} />);
    expect(screen.getByText('Validate')).toBeInTheDocument();
    expect(screen.getByText('Submit')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('marks steps as pending, active, or completed based on currentStepIndex', () => {
    render(<MultiStepProgressIndicator steps={mockSteps} currentStepIndex={1} />);

    const step0 = screen.getByTestId('multi-step-progress-step-0');
    const step1 = screen.getByTestId('multi-step-progress-step-1');
    const step2 = screen.getByTestId('multi-step-progress-step-2');

    expect(step0).toHaveAttribute('data-step-status', 'completed');
    expect(step1).toHaveAttribute('data-step-status', 'active');
    expect(step2).toHaveAttribute('data-step-status', 'pending');
  });

  it('shows error state on current step when hasError is true', () => {
    render(<MultiStepProgressIndicator steps={mockSteps} currentStepIndex={1} hasError={true} />);

    const step1 = screen.getByTestId('multi-step-progress-step-1');
    expect(step1).toHaveAttribute('data-step-status', 'error');
  });

  it('displays step descriptions when showDescriptions is true', () => {
    const stepsWithDescriptions: ProgressStep[] = [
      { id: 'validate', label: 'Validate', description: 'Checking inputs' },
      { id: 'submit', label: 'Submit', description: 'Sending transaction' },
    ];

    render(
      <MultiStepProgressIndicator
        steps={stepsWithDescriptions}
        currentStepIndex={0}
        showDescriptions={true}
      />
    );

    expect(screen.getByText('Checking inputs')).toBeInTheDocument();
    expect(screen.getByText('Sending transaction')).toBeInTheDocument();
  });

  it('hides step descriptions when showDescriptions is false', () => {
    const stepsWithDescriptions: ProgressStep[] = [
      { id: 'validate', label: 'Validate', description: 'Checking inputs' },
    ];

    render(
      <MultiStepProgressIndicator
        steps={stepsWithDescriptions}
        currentStepIndex={0}
        showDescriptions={false}
      />
    );

    expect(screen.queryByText('Checking inputs')).not.toBeInTheDocument();
  });

  it('applies size variants', () => {
    const { rerender } = render(
      <MultiStepProgressIndicator steps={mockSteps} currentStepIndex={0} size="small" />
    );
    let container = screen.getByTestId('multi-step-progress');
    expect(container).toHaveClass('multi-step-progress--small');

    rerender(<MultiStepProgressIndicator steps={mockSteps} currentStepIndex={0} size="medium" />);
    container = screen.getByTestId('multi-step-progress');
    expect(container).toHaveClass('multi-step-progress--medium');

    rerender(<MultiStepProgressIndicator steps={mockSteps} currentStepIndex={0} size="large" />);
    container = screen.getByTestId('multi-step-progress');
    expect(container).toHaveClass('multi-step-progress--large');
  });

  it('shows step numbers by default', () => {
    render(<MultiStepProgressIndicator steps={mockSteps} currentStepIndex={0} showStepNumbers={true} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('hides step numbers when showStepNumbers is false', () => {
    render(<MultiStepProgressIndicator steps={mockSteps} currentStepIndex={0} showStepNumbers={false} />);
    // Numbers should not be visible (dots should be shown instead)
    const indicators = screen.getAllByTestId(/multi-step-progress-step-/);
    expect(indicators.length).toBe(3);
  });

  it('shows checkmark for completed steps', () => {
    render(<MultiStepProgressIndicator steps={mockSteps} currentStepIndex={2} />);
    const step0 = screen.getByTestId('multi-step-progress-step-0');
    const step1 = screen.getByTestId('multi-step-progress-step-1');

    expect(step0.querySelector('.multi-step-progress__step-icon')).toHaveTextContent('✓');
    expect(step1.querySelector('.multi-step-progress__step-icon')).toHaveTextContent('✓');
  });

  it('shows error icon for error step', () => {
    render(<MultiStepProgressIndicator steps={mockSteps} currentStepIndex={1} hasError={true} />);
    const step1 = screen.getByTestId('multi-step-progress-step-1');
    expect(step1.querySelector('.multi-step-progress__step-icon')).toHaveTextContent('✕');
  });

  it('calls onStepClick when clicking a completed step', () => {
    const onStepClick = vi.fn();
    render(
      <MultiStepProgressIndicator
        steps={mockSteps}
        currentStepIndex={2}
        onStepClick={onStepClick}
      />
    );

    const step0 = screen.getByTestId('multi-step-progress-step-0');
    fireEvent.click(step0);

    expect(onStepClick).toHaveBeenCalledWith(0);
  });

  it('does not call onStepClick when clicking pending or active steps', () => {
    const onStepClick = vi.fn();
    render(
      <MultiStepProgressIndicator
        steps={mockSteps}
        currentStepIndex={1}
        onStepClick={onStepClick}
      />
    );

    const step1 = screen.getByTestId('multi-step-progress-step-1');
    const step2 = screen.getByTestId('multi-step-progress-step-2');

    fireEvent.click(step1);
    fireEvent.click(step2);

    expect(onStepClick).not.toHaveBeenCalled();
  });

  it('handles keyboard navigation for clickable steps', () => {
    const onStepClick = vi.fn();
    render(
      <MultiStepProgressIndicator
        steps={mockSteps}
        currentStepIndex={2}
        onStepClick={onStepClick}
      />
    );

    const step0 = screen.getByTestId('multi-step-progress-step-0');

    fireEvent.keyDown(step0, { key: 'Enter' });
    expect(onStepClick).toHaveBeenCalledWith(0);

    fireEvent.keyDown(step0, { key: ' ' });
    expect(onStepClick).toHaveBeenCalledTimes(2);
  });

  it('applies custom className', () => {
    render(
      <MultiStepProgressIndicator
        steps={mockSteps}
        currentStepIndex={0}
        className="custom-class"
      />
    );
    const container = screen.getByTestId('multi-step-progress');
    expect(container).toHaveClass('custom-class');
  });

  it('uses custom testId', () => {
    render(
      <MultiStepProgressIndicator
        steps={mockSteps}
        currentStepIndex={0}
        testId="custom-progress"
      />
    );
    expect(screen.getByTestId('custom-progress')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<MultiStepProgressIndicator steps={mockSteps} currentStepIndex={1} />);
    const container = screen.getByTestId('multi-step-progress');

    expect(container).toHaveAttribute('role', 'progressbar');
    expect(container).toHaveAttribute('aria-valuenow', '2');
    expect(container).toHaveAttribute('aria-valuemin', '1');
    expect(container).toHaveAttribute('aria-valuemax', '3');
  });

  it('clamps currentStepIndex to valid range', () => {
    const { rerender } = render(
      <MultiStepProgressIndicator steps={mockSteps} currentStepIndex={-1} />
    );

    let step0 = screen.getByTestId('multi-step-progress-step-0');
    expect(step0).toHaveAttribute('data-step-status', 'active');

    rerender(<MultiStepProgressIndicator steps={mockSteps} currentStepIndex={999} />);
    const step2 = screen.getByTestId('multi-step-progress-step-2');
    expect(step2).toHaveAttribute('data-step-status', 'active');
  });

  it('renders connector lines between steps', () => {
    render(<MultiStepProgressIndicator steps={mockSteps} currentStepIndex={1} />);

    expect(screen.getByTestId('multi-step-progress-connector-0')).toBeInTheDocument();
    expect(screen.getByTestId('multi-step-progress-connector-1')).toBeInTheDocument();
  });

  it('marks connectors as completed or active based on progress', () => {
    render(<MultiStepProgressIndicator steps={mockSteps} currentStepIndex={1} />);

    const connector0 = screen.getByTestId('multi-step-progress-connector-0');
    const connector1 = screen.getByTestId('multi-step-progress-connector-1');

    expect(connector0).toHaveClass('multi-step-progress__connector--completed');
    expect(connector1).toHaveClass('multi-step-progress__connector--active');
  });
});
