"use client";

import { useState, ReactNode } from "react";
import { Button } from "@workspace/ui/components/button";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { cn } from "@/lib/utils";

export type WizardStep = {
    id: string;
    title: string;
    description?: string;
    component: ReactNode;
    validate?: () => Promise<boolean> | boolean;
    actionButtons?: ReactNode;
    disabledTooltip?: string;
    isNextDisabled?: boolean;
};

type SetupWizardProps = {
    steps: WizardStep[];
    onComplete: () => void | Promise<void>;
    onCancel?: () => void;
    currentStepIndex?: number;
};

export function SetupWizard({
    steps,
    onComplete,
    onCancel,
    currentStepIndex: controlledStep
}: SetupWizardProps) {
    const [currentStep, setCurrentStep] = useState(controlledStep ?? 0);
    const [isValidating, setIsValidating] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);

    const step = steps[currentStep];
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === steps.length - 1;

    const handleNext = async () => {
        if (step.validate) {
            setIsValidating(true);
            const isValid = await step.validate();
            setIsValidating(false);

            if (!isValid) return;
        }

        if (isLastStep) {
            setIsCompleting(true);
            await onComplete();
            setIsCompleting(false);
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (!isFirstStep) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const progressPercentage = ((currentStep + 1) / steps.length) * 100;

    return (
        <TooltipProvider>
            <div className="flex flex-col gap-6 size-full">
                {/* Progress Bar */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            Step {currentStep + 1} of {steps.length}
                        </span>
                        <span className="text-muted-foreground">
                            {Math.round(progressPercentage)}%
                        </span>
                    </div>
                    <div className="bg-card/30 border rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-primary h-full transition-all duration-300"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold">{step.title}</h2>
                        {step.description && (
                            <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                        )}
                    </div>
                </div>

                {/* Step Content */}
                <div className="bg-card/50 border rounded shadow p-6 flex-1 overflow-auto">
                    {step.component}
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between">
                    <div>
                        {!isFirstStep && (
                            <Button
                                variant="outline"
                                onClick={handleBack}
                                disabled={isValidating || isCompleting}
                                className="gap-2"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Back
                            </Button>
                        )}
                        {onCancel && isFirstStep && (
                            <Button
                                variant="ghost"
                                onClick={onCancel}
                                disabled={isValidating || isCompleting}
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {step.actionButtons}
                        {step.disabledTooltip && step.isNextDisabled ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span tabIndex={0}>
                                        <Button
                                            onClick={handleNext}
                                            disabled={true}
                                            className="gap-2"
                                        >
                                            {isValidating ? (
                                                "Validating..."
                                            ) : isCompleting ? (
                                                "Completing..."
                                            ) : isLastStep ? (
                                                <>
                                                    <Check className="w-4 h-4" />
                                                    Complete Setup
                                                </>
                                            ) : (
                                                <>
                                                    Next
                                                    <ChevronRight className="w-4 h-4" />
                                                </>
                                            )}
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{step.disabledTooltip}</p>
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <Button
                                onClick={handleNext}
                                disabled={isValidating || isCompleting || step.isNextDisabled}
                                className="gap-2"
                            >
                                {isValidating ? (
                                    "Validating..."
                                ) : isCompleting ? (
                                    "Completing..."
                                ) : isLastStep ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Complete Setup
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <ChevronRight className="w-4 h-4" />
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
