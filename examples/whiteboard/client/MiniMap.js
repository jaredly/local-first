// @flow
import React from 'react';

import type { pos, rect } from './types';

const MiniMap = ({
    zoom,
    pan,
    BOUNDS,
}: {
    zoom: number,
    pan: pos,
    BOUNDS: rect,
}) => {
    const width = 100;
    const height = (BOUNDS.size.y / BOUNDS.size.x) * width;
    const iw = window.innerWidth / zoom / BOUNDS.size.x;
    const ih = window.innerHeight / zoom / BOUNDS.size.y;
    const x = (pan.x - BOUNDS.position.x) / BOUNDS.size.x;
    const y = (pan.y - BOUNDS.position.y) / BOUNDS.size.y;
    return (
        <div
            style={{
                position: 'absolute',
                right: 20,
                bottom: 20,
                width,
                height,
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
    );
};

export default MiniMap;
