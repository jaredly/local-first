// @flow
import React from 'react';

import type { pos, rect } from '../types';

const zoomLevels = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.5, 2.0];

const MiniMap = ({
    windowSize,
    zoom,
    pan,
    BOUNDS,
    setZoom,
}: {
    windowSize: pos,
    zoom: number,
    pan: pos,
    BOUNDS: rect,
    setZoom: number => void,
}) => {
    const width = 100;
    const height = (BOUNDS.size.y / BOUNDS.size.x) * width;
    const iw = windowSize.x / zoom / BOUNDS.size.x;
    const ih = windowSize.y / zoom / BOUNDS.size.y;
    const x = (pan.x - BOUNDS.position.x) / BOUNDS.size.x;
    const y = (pan.y - BOUNDS.position.y) / BOUNDS.size.y;
    return (
        <div
            style={{
                position: 'absolute',
                right: 20,
                bottom: 20,
                flexDirection: 'row',
                display: 'flex',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                }}
            >
                <button
                    onClick={() => {
                        const idx = zoomLevels.indexOf(zoom);
                        if (idx < zoomLevels.length - 1) {
                            setZoom(zoomLevels[idx + 1]);
                        }
                        //
                    }}
                >
                    +
                </button>
                <button
                    onClick={() => {
                        //
                        const idx = zoomLevels.indexOf(zoom);
                        if (idx >= 1) {
                            setZoom(zoomLevels[idx - 1]);
                        }
                    }}
                >
                    -
                </button>
            </div>
            <div
                style={{
                    width,
                    height,
                    position: 'relative',
                    backgroundColor: 'rgba(100,100,255,0.2)',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        backgroundColor: 'rgba(100,100,255,0.2)',
                        left: x * width,
                        top: y * height,
                        width: width * iw,
                        height: height * ih,
                    }}
                />
            </div>
        </div>
    );
};

export default MiniMap;
