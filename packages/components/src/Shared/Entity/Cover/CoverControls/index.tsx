import { useMemo, useEffect, useCallback, useState } from "react";
import styled from "@emotion/styled";
import { ControlSlider, Column, Row, useBreakpoint, fallback, ButtonGroup, ButtonGroupButton } from "@components";
import { useEntity, supportsFeatureFromAttributes, isUnavailableState, localize, useIcon } from "@hakit/core";
import type { EntityName, CoverEntity, FilterByDomain } from "@hakit/core";
import { ErrorBoundary } from "react-error-boundary";

const enum CoverEntityFeature {
  OPEN = 1,
  CLOSE = 2,
  SET_POSITION = 4,
  STOP = 8,
  OPEN_TILT = 16,
  CLOSE_TILT = 32,
  STOP_TILT = 64,
  SET_TILT_POSITION = 128,
}

const CompactLayout = styled.div`
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.75rem;
`;

const CompactContent = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const ModeToggleButton = styled.button<{
  size: number;
}>`
  width: ${(props) => props.size}px;
  height: ${(props) => props.size}px;
  min-width: ${(props) => props.size}px;
  min-height: ${(props) => props.size}px;
  outline: none;
  cursor: pointer;
  border: 0;
  border-radius: 0.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: var(--ha-S300);
  color: var(--ha-S500-contrast);
  transition: var(--ha-transition-duration) var(--ha-easing);
  transition-property: transform, background-color, color, box-shadow, opacity;
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.1);

  &:hover:not(:disabled) {
    background-color: var(--ha-S400);
  }

  &:active:not(:disabled) {
    transform: scale(0.9);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

const Label = styled.span`
  font-size: 0.8rem;
  margin-top: 0.5rem;
  text-transform: uppercase;
`;

function computeTitleDisplay(entity: CoverEntity, position?: number) {
  const isUnavailable = isUnavailableState(entity.state);
  const statePosition =
    !isUnavailable && entity.state !== "closed"
      ? (entity.attributes.current_position ?? entity.attributes.current_tilt_position)
      : undefined;

  const currentPosition = position ?? statePosition;

  const suffix = currentPosition && currentPosition !== 100 ? (currentPosition ?? entity.attributes.current_position ?? "") : "";
  if (typeof position === "number") {
    return `${position === 0 ? "closed" : position === 100 ? "open" : entity.state}${suffix ? ` - ${suffix}%` : ""}`;
  }
  return `${entity.state}${suffix ? ` - ${suffix}%` : ""}`;
}

function mapCoverPositionForDisplay(position: number, reverse: boolean, isCompactHorizontal: boolean) {
  if (!isCompactHorizontal || !reverse) return position;
  return 100 - position;
}

function mapCoverPositionForService(position: number, reverse: boolean, isCompactHorizontal: boolean) {
  if (!isCompactHorizontal || !reverse) return position;
  return 100 - position;
}

type Mode = "position" | "button";
type Orientation = "vertical" | "horizontal";

export interface CoverControlsProps {
  entity: FilterByDomain<EntityName, "cover">;
  onStateChange?: (state: string) => void;
  mode?: Mode;
  /** the orientation of the slider, useful if you want to represent the slider to match your curtain/blind orientation */
  orientation?: Orientation;
  /** reverse the direction of the slider, useful if you want the ui to reflect the actual cover, the UI will not change, but the actions will reverse, open becomes close, just changes the order */
  reverse?: boolean;
  /** override the button size used when mode is set to button */
  buttonSize?: number;
}

function InternalCoverControls({
  entity: _entity,
  mode = "position",
  orientation = "vertical",
  reverse = false,
  onStateChange,
  buttonSize,
}: CoverControlsProps) {
  const entity = useEntity(_entity);
  const isUnavailable = isUnavailableState(entity.state);
  const supports = useCallback(
    (feature: CoverEntityFeature) => {
      return supportsFeatureFromAttributes(entity.attributes, feature);
    },
    [entity.attributes],
  );
  const supportsPosition = supports(CoverEntityFeature.SET_POSITION);
  const supportsTiltPosition = supports(CoverEntityFeature.SET_TILT_POSITION);
  const supportsSliderMode = supportsPosition || supportsTiltPosition;

  const supportsOpenClose = supports(CoverEntityFeature.OPEN) || supports(CoverEntityFeature.CLOSE) || supports(CoverEntityFeature.STOP);

  const supportsTilt =
    supports(CoverEntityFeature.OPEN_TILT) || supports(CoverEntityFeature.CLOSE_TILT) || supports(CoverEntityFeature.STOP_TILT);

  const [_mode, setMode] = useState<Mode>(supportsSliderMode && mode === "position" ? "position" : "button");

  const device = useBreakpoint();
  const titleValue = useMemo(() => {
    return computeTitleDisplay(entity);
  }, [entity]);
  const isCompactHorizontal = orientation === "horizontal";
  const isCompactHorizontalSmall = isCompactHorizontal && device.xxs;
  const buttonThickness = buttonSize ?? (device.xxs ? 80 : 96);
  const buttonGap = isCompactHorizontal ? "0.625rem" : "1rem";
  const buttonGroupMinLength = `calc(${buttonThickness}px * 3 + (${buttonGap} * 2))`;
  const sliderThickness = isCompactHorizontal ? buttonThickness : device.xxs ? 90 : 100;
  const sliderBorderRadius = isCompactHorizontal ? 6 : 24;
  const modeToggleSize = isCompactHorizontalSmall ? Math.max(34, Math.round(buttonThickness * 0.7)) : isCompactHorizontal ? Math.max(38, Math.round(buttonThickness * 0.66)) : 44;
  const compactGap = isCompactHorizontalSmall ? "0.5rem" : "0.75rem";
  const toggleModeIcon = useIcon(_mode === "button" ? "mdi:gesture-tap-button" : "mdi:tune-vertical", {
    width: "18px",
    height: "18px",
  });
  const toggleModeTitle = _mode === "button" ? localize("button") : localize("position");

  useEffect(() => {
    if (supportsSliderMode && mode === "position") {
      setMode("position");
      return;
    }
    setMode("button");
  }, [mode, supportsSliderMode]);

  useEffect(() => {
    if (onStateChange) {
      onStateChange(titleValue);
    }
  }, [titleValue, onStateChange]);

  const renderModeToggle = () => {
    if (!supportsSliderMode) return null;
    return (
      <ModeToggleButton
        type="button"
        size={modeToggleSize}
        title={toggleModeTitle}
        aria-label={toggleModeTitle}
        onClick={() => {
          setMode((currentMode) => (currentMode === "button" ? "position" : "button"));
        }}
      >
        {toggleModeIcon}
      </ModeToggleButton>
    );
  };

  const renderPositionSlider = (position: number, label: string, onApply: (value: number) => void) => {
    const displayValue = mapCoverPositionForDisplay(position, reverse, isCompactHorizontal);
    return (
      <Column>
        <ControlSlider
          sliderColor={isUnavailable ? undefined : `var(--ha-A400)`}
          min={0}
          max={100}
          mode={isCompactHorizontal ? "start" : reverse ? "end" : "start"}
          vertical={orientation === "vertical"}
          thickness={sliderThickness}
          borderRadius={sliderBorderRadius}
          value={displayValue}
          showHandle={!isCompactHorizontal}
          disabled={isUnavailable}
          style={
            isCompactHorizontal
              ? {
                  minWidth: isCompactHorizontalSmall ? 0 : buttonGroupMinLength,
                  maxWidth: isCompactHorizontalSmall ? "100%" : buttonGroupMinLength,
                  width: isCompactHorizontalSmall ? "100%" : buttonGroupMinLength,
                }
              : undefined
          }
          onChange={(value) => {
            const serviceValue = mapCoverPositionForService(value, reverse, isCompactHorizontal);
            if (onStateChange) onStateChange(computeTitleDisplay(entity, Math.round(serviceValue)));
          }}
          onChangeApplied={(value) => {
            onApply(mapCoverPositionForService(value, reverse, isCompactHorizontal));
            if (onStateChange) onStateChange(computeTitleDisplay(entity, Math.round(mapCoverPositionForService(value, reverse, isCompactHorizontal))));
          }}
        />
        {!isCompactHorizontal && <Label>{label}</Label>}
      </Column>
    );
  };

  const renderButtonGroup = (
    buttons: Array<{
      title: string;
      service: "openCover" | "stopCover" | "closeCover" | "openCoverTilt" | "stopCoverTilt" | "closeCoverTilt";
      icon: string;
    }>,
    label: string,
  ) => {
    return (
      <Column>
        <ButtonGroup
          thickness={buttonThickness}
          reverse={reverse}
          orientation={orientation}
          gap={buttonGap}
          style={{
            minHeight: orientation === "vertical" ? buttonGroupMinLength : undefined,
            maxHeight: orientation === "vertical" ? "320px" : undefined,
            height: orientation === "vertical" ? "45vh" : undefined,
            minWidth: orientation === "horizontal" ? (isCompactHorizontalSmall ? 0 : buttonGroupMinLength) : undefined,
            maxWidth: orientation === "horizontal" ? (isCompactHorizontalSmall ? "100%" : buttonGroupMinLength) : undefined,
            width: orientation === "horizontal" ? (isCompactHorizontalSmall ? "100%" : buttonGroupMinLength) : undefined,
            flexWrap: "nowrap",
          }}
        >
          {buttons.map((button) => (
            <ButtonGroupButton key={button.service} title={button.title} entity={_entity} service={button.service} icon={button.icon} />
          ))}
        </ButtonGroup>
        {!isCompactHorizontal && <Label>{label}</Label>}
      </Column>
    );
  };

  return (
    <Column
      fullHeight
      wrap="nowrap"
      justifyContent={device.xxs ? "flex-start" : "flex-start"}
      style={{
        padding: device.xxs ? "1rem" : "0",
      }}
    >
      <Column>
        {isCompactHorizontal ? (
          <CompactLayout
            style={{
              gap: compactGap,
            }}
          >
            <CompactContent
              style={
                isCompactHorizontalSmall
                  ? {
                      flex: "0 1 calc(75% - 0.25rem)",
                      maxWidth: "calc(75% - 0.25rem)",
                      minWidth: 0,
                    }
                  : undefined
              }
            >
              {_mode === "position" && (
                <>
                  {supportsPosition &&
                    typeof entity.attributes.current_position !== "undefined" &&
                    renderPositionSlider(entity.attributes.current_position, localize("cover_position"), (value) => {
                      entity.service.setCoverPosition({
                        serviceData: {
                          position: value,
                        },
                      });
                    })}
                  {supportsTiltPosition &&
                    typeof entity.attributes.current_tilt_position !== "undefined" &&
                    renderPositionSlider(entity.attributes.current_tilt_position, localize("cover_tilt_position"), (value) => {
                      entity.service.setCoverTiltPosition({
                        serviceData: {
                          tilt_position: value,
                        },
                      });
                    })}
                </>
              )}
              {_mode === "button" && (
                <>
                  {supportsOpenClose &&
                    renderButtonGroup(
                      [
                        {
                          title: localize("open_cover"),
                          service: "openCover",
                          icon: reverse ? "mdi:arrow-down" : "mdi:arrow-up",
                        },
                        {
                          title: localize("stop_cover"),
                          service: "stopCover",
                          icon: "mdi:stop",
                        },
                        {
                          title: localize("close_cover"),
                          service: "closeCover",
                          icon: !reverse ? "mdi:arrow-down" : "mdi:arrow-up",
                        },
                      ],
                      localize("control"),
                    )}
                  {supportsTilt &&
                    renderButtonGroup(
                      [
                        {
                          title: localize("open_cover_tilt"),
                          service: "openCoverTilt",
                          icon: reverse ? "mdi:arrow-collapse" : "mdi:arrow-expand",
                        },
                        {
                          title: localize("stops_a_tilting_cover_movement"),
                          service: "stopCoverTilt",
                          icon: "mdi:stop",
                        },
                        {
                          title: localize("close_cover_tilt"),
                          service: "closeCoverTilt",
                          icon: !reverse ? "mdi:arrow-collapse" : "mdi:arrow-expand",
                        },
                      ],
                      localize("tilt_position"),
                    )}
                </>
              )}
            </CompactContent>
            <div
              style={
                isCompactHorizontalSmall
                  ? {
                      flex: "0 0 calc(25% - 0.25rem)",
                      maxWidth: "calc(25% - 0.25rem)",
                      minWidth: `${Math.max(36, Math.round(buttonThickness * 0.55))}px`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }
                  : undefined
              }
            >
              {renderModeToggle()}
            </div>
          </CompactLayout>
        ) : (
          <>
            {_mode === "position" && (
              <>
                <Row
                  gap="1rem"
                  style={{
                    flexDirection: orientation === "vertical" ? "row" : "column",
                  }}
                >
                  {supportsPosition &&
                    typeof entity.attributes.current_position !== "undefined" &&
                    renderPositionSlider(entity.attributes.current_position, localize("cover_position"), (value) => {
                      entity.service.setCoverPosition({
                        serviceData: {
                          position: value,
                        },
                      });
                    })}
                  {supportsTiltPosition &&
                    typeof entity.attributes.current_tilt_position !== "undefined" &&
                    renderPositionSlider(entity.attributes.current_tilt_position, localize("cover_tilt_position"), (value) => {
                      entity.service.setCoverTiltPosition({
                        serviceData: {
                          tilt_position: value,
                        },
                      });
                    })}
                </Row>
              </>
            )}
            {_mode === "button" && (
              <>
                <Row
                  gap="1rem"
                  style={{
                    flexDirection: orientation === "vertical" ? "row" : "column",
                  }}
                >
                  {supportsOpenClose &&
                    renderButtonGroup(
                      [
                        {
                          title: localize("open_cover"),
                          service: "openCover",
                          icon: reverse ? "mdi:arrow-down" : "mdi:arrow-up",
                        },
                        {
                          title: localize("stop_cover"),
                          service: "stopCover",
                          icon: "mdi:stop-circle-outline",
                        },
                        {
                          title: localize("close_cover"),
                          service: "closeCover",
                          icon: !reverse ? "mdi:arrow-down" : "mdi:arrow-up",
                        },
                      ],
                      localize("control"),
                    )}
                  {supportsTilt &&
                    renderButtonGroup(
                      [
                        {
                          title: localize("open_cover_tilt"),
                          service: "openCoverTilt",
                          icon: reverse ? "mdi:arrow-collapse" : "mdi:arrow-expand",
                        },
                        {
                          title: localize("stops_a_tilting_cover_movement"),
                          service: "stopCoverTilt",
                          icon: "mdi:stop-circle-outline",
                        },
                        {
                          title: localize("close_cover_tilt"),
                          service: "closeCoverTilt",
                          icon: !reverse ? "mdi:arrow-collapse" : "mdi:arrow-expand",
                        },
                      ],
                      localize("tilt_position"),
                    )}
                </Row>
              </>
            )}
            {renderModeToggle()}
          </>
        )}
      </Column>
    </Column>
  );
}

/** This component will render controls for a cover, it supports tilt & position sliders, as well as a button mode
 *
 * The below demos show how different cover entities will render based on what they support, this is automatic and no need to configure anything.
 */
export function CoverControls(props: CoverControlsProps) {
  return (
    <ErrorBoundary {...fallback({ prefix: "CoverControls" })}>
      <InternalCoverControls {...props} />
    </ErrorBoundary>
  );
}
