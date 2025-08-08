"use client";

import React, { useRef, useState, useEffect } from "react";
import { AnimatedBeam } from "@/components/magicui/animated-beam";

export default function AnimatedBeamDemo() {
  const containerRef     = useRef<HTMLDivElement>(null);
  const topLeftRef       = useRef<HTMLDivElement>(null);
  const bottomLeftRef    = useRef<HTMLDivElement>(null);
  const topRightRef      = useRef<HTMLDivElement>(null);
  const bottomRightRef   = useRef<HTMLDivElement>(null);
  const centerLeftRef    = useRef<HTMLDivElement>(null);
  const centerRightRef   = useRef<HTMLDivElement>(null);

  // Track viewport width to adjust curvature
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Smaller arc on mobile
  const outerCurvature = isMobile ? 100 : 200;
  const innerCurvature = 0; // straight on both

  return (
      <div
          ref={containerRef}
          className="
        relative flex w-full
        h-[60vh]        md:h-[1200px]
        items-center justify-center
        overflow-hidden rounded-xl
      "
      >
        {/* Invisible anchor points */}
        <div ref={topLeftRef}     className="absolute left-0   top-1/3 w-1 h-1 opacity-0" />
        <div ref={bottomLeftRef}  className="absolute left-0   top-2/3 w-1 h-1 opacity-0" />
        <div ref={topRightRef}    className="absolute right-0  top-1/3 w-1 h-1 opacity-0" />
        <div ref={bottomRightRef} className="absolute right-0  top-2/3 w-1 h-1 opacity-0" />
        <div ref={centerLeftRef}  className="absolute left-0   top-1/2 w-1 h-1 opacity-0" />
        <div ref={centerRightRef} className="absolute right-0  top-1/2 w-1 h-1 opacity-0" />

        {/* Top beam (bows downward) */}
        <AnimatedBeam
            duration={4}
            delay={0}
            containerRef={containerRef}
            fromRef={topLeftRef}
            toRef={topRightRef}
            curvature={ outerCurvature }
            pathWidth={3}
            pathOpacity={0.1}
            gradientStartColor="#25206b"
            gradientStopColor="#25206b"
        />

        {/* Center straight beam */}
        <AnimatedBeam
            duration={3}
            delay={0.5}
            containerRef={containerRef}
            fromRef={centerLeftRef}
            toRef={centerRightRef}
            curvature={ innerCurvature }
            pathWidth={3}
            pathOpacity={0.1}
            gradientStartColor="#25206b"
            gradientStopColor="#25206b"
        />

        {/* Bottom beam (bows upward) */}
        <AnimatedBeam
            duration={4}
            delay={1}
            containerRef={containerRef}
            fromRef={bottomLeftRef}
            toRef={bottomRightRef}
            curvature={ -outerCurvature }
            pathWidth={3}
            pathOpacity={0.1}
            gradientStartColor="#25206b"
            gradientStopColor="#25206b"
        />
      </div>
  );
}