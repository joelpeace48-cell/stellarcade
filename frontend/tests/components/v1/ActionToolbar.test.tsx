import { render, screen, fireEvent } from '@testing-library/react';
import { ActionToolbar, ToolbarAction } from '../../../src/components/v1/ActionToolbar';

describe('ActionToolbar', () => {
    const mockActions: ToolbarAction[] = [
        { id: '1', label: 'Primary', onClick: vi.fn(), intent: 'primary' },
        { id: '2', label: 'Secondary', onClick: vi.fn(), intent: 'secondary' },
        { id: '3', label: 'Tertiary', onClick: vi.fn(), intent: 'tertiary' },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders all actions with correct labels', () => {
        render(<ActionToolbar actions={mockActions} />);
        expect(screen.getByText('Primary')).toBeInTheDocument();
        expect(screen.getByText('Secondary')).toBeInTheDocument();
        expect(screen.getByText('Tertiary')).toBeInTheDocument();
    });

    it('triggers onClick when an action is clicked', () => {
        render(<ActionToolbar actions={mockActions} />);
        fireEvent.click(screen.getByText('Primary'));
        expect(mockActions[0].onClick).toHaveBeenCalled();
    });

    it('does not trigger onClick when an action is disabled', () => {
        const disabledAction: ToolbarAction = {
            id: '4', label: 'Disabled', onClick: vi.fn(), isDisabled: true
        };
        render(<ActionToolbar actions={[disabledAction]} />);

        const btn = screen.getByRole('button');
        expect(btn).toBeDisabled();
        fireEvent.click(btn);
        expect(disabledAction.onClick).not.toHaveBeenCalled();
    });

    it('renders loading state and disables interaction', () => {
        const loadingAction: ToolbarAction = {
            id: '5', label: 'Loading', onClick: vi.fn(), isLoading: true
        };
        render(<ActionToolbar actions={[loadingAction]} />);

        const btn = screen.getByRole('button');
        expect(btn).toBeDisabled();
        expect(btn.querySelector('.stellarcade-toolbar-spinner')).toBeInTheDocument();
        fireEvent.click(btn);
        expect(loadingAction.onClick).not.toHaveBeenCalled();
    });

    it('renders with vertical orientation', () => {
        render(<ActionToolbar actions={mockActions} orientation="vertical" />);
        const toolbar = screen.getByRole('toolbar');
        expect(toolbar).toHaveClass('stellarcade-action-toolbar--vertical');
    });

    it('keeps all toolbar actions in the tab order', () => {
        render(<ActionToolbar actions={mockActions} />);
        const buttons = screen.getAllByRole('button');

        expect(buttons.every((button) => button.tabIndex === 0)).toBe(true);
    });

    it('handles keyboard navigation with arrow keys', () => {
        render(<ActionToolbar actions={mockActions} />);
        const buttons = screen.getAllByRole('button');

        buttons[0].focus();
        fireEvent.keyDown(buttons[0], { key: 'ArrowRight' });
        expect(document.activeElement).toBe(buttons[1]);

        fireEvent.keyDown(buttons[1], { key: 'ArrowLeft' });
        expect(document.activeElement).toBe(buttons[0]);
    });

    it('supports Home and End keyboard navigation', () => {
        render(<ActionToolbar actions={mockActions} />);
        const buttons = screen.getAllByRole('button');

        buttons[1].focus();
        fireEvent.keyDown(buttons[1], { key: 'End' });
        expect(document.activeElement).toBe(buttons[2]);

        fireEvent.keyDown(buttons[2], { key: 'Home' });
        expect(document.activeElement).toBe(buttons[0]);
    });

    it('returns null if no actions are provided', () => {
        const { container } = render(<ActionToolbar actions={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders icons when provided', () => {
        const actionWithIcon: ToolbarAction = {
            id: '6', label: 'Icon', onClick: vi.fn(), icon: <span data-testid="test-icon">icon</span>
        };
        render(<ActionToolbar actions={[actionWithIcon]} />);
        expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });
});
