import React, { useEffect, useRef, useState } from 'react';
import './WidgetTransitionGuard.css';

export interface WidgetTransitionGuardProps {
  populated: boolean;
  children: React.ReactNode;
  animationClass?: string;
  testId?: string;
}

export const WidgetTransitionGuard: React.FC<WidgetTransitionGuardProps> = ({
  populated,
  children,
  animationClass = 'widget-transition--populate',
  testId = 'widget-transition-guard',
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const prevPopulatedRef = useRef<boolean>(populated);

  useEffect(() => {
    if (!prevPopulatedRef.current && populated) {
      setIsAnimating(true);
    }
    prevPopulatedRef.current = populated;
  }, [populated]);

  const handleAnimationEnd = () => setIsAnimating(false);

  const classes = ['widget-transition-guard', isAnimating ? animationClass : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      data-testid={testId}
      data-populated={populated}
      data-animating={isAnimating}
      onAnimationEnd={handleAnimationEnd}
    >
      {children}
    </div>
  );
};

export default WidgetTransitionGuard;
