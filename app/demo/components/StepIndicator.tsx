'use client';

import React from 'react';
import { StepId } from '../types';

interface StepIndicatorProps {
  currentStep: StepId;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const steps = [1, 2, 3, 4];

  return (
    <div className="flex items-center justify-center space-x-4 mb-12">
      {steps.map((s, index) => (
        <React.Fragment key={s}>
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 font-bold border-2 ${
                currentStep === s
                  ? 'bg-gradient-to-r from-[#FF3B6B] to-[#7C3AED] border-transparent text-white'
                  : currentStep > s
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400'
              }`}
            >
              {currentStep > s ? '✓' : s}
            </div>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-16 h-1 rounded-full transition-colors duration-300 ${
                currentStep > s ? 'bg-green-500' : 'bg-gray-700'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default StepIndicator;
