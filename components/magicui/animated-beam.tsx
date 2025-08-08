"use client"

import type React from "react"
import { motion } from "motion/react"
import { type RefObject, useEffect, useId, useState } from "react"
import { cn } from "@/lib/utils"

export interface AnimatedBeamProps {
  className?: string
  containerRef: RefObject<HTMLElement | null>
  fromRef: RefObject<HTMLElement | null>
  toRef: RefObject<HTMLElement | null>
  curvature?: number
  reverse?: boolean
  pathColor?: string
  pathWidth?: number
  pathOpacity?: number
  gradientStartColor?: string
  gradientStopColor?: string
  delay?: number
  duration?: number
  startXOffset?: number
  startYOffset?: number
  endXOffset?: number
  endYOffset?: number
}

export const AnimatedBeam: React.FC<AnimatedBeamProps> = ({
                                                            className,
                                                            containerRef,
                                                            fromRef,
                                                            toRef,
                                                            curvature = 0,
                                                            reverse = false,
                                                            duration = Math.random() * 3 + 4,
                                                            delay = 0,
                                                            pathColor = "gray",
                                                            pathWidth = 2,
                                                            pathOpacity = 0.2,
                                                            gradientStartColor = "#ffaa40",
                                                            gradientStopColor = "#9c40ff",
                                                            startXOffset = 0,
                                                            startYOffset = 0,
                                                            endXOffset = 0,
                                                            endYOffset = 0,
                                                          }) => {
  const id = useId()
  const [pathD, setPathD] = useState("")
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 })

  const gradientCoordinates = reverse
      ? {
        x1: ["90%", "-10%"],
        x2: ["100%", "0%"],
        y1: ["0%", "0%"],
        y2: ["0%", "0%"],
      }
      : {
        x1: ["10%", "110%"],
        x2: ["0%", "100%"],
        y1: ["0%", "0%"],
        y2: ["0%", "0%"],
      }

  useEffect(() => {
    const updatePath = () => {
      if (!containerRef.current || !fromRef.current || !toRef.current) return
      const C = containerRef.current.getBoundingClientRect()
      const A = fromRef.current.getBoundingClientRect()
      const B = toRef.current.getBoundingClientRect()

      setSvgDimensions({ width: C.width, height: C.height })

      const startX = A.left - C.left + A.width / 2 + startXOffset
      const startY = A.top - C.top + A.height / 2 + startYOffset
      const endX = B.left - C.left + B.width / 2 + endXOffset
      const endY = B.top - C.top + B.height / 2 + endYOffset

      const dx = endX - startX
      const cp1X = startX + dx * 0.25
      const cp1Y = startY + curvature
      const cp2X = startX + dx * 0.75
      const cp2Y = endY + curvature

      setPathD(`M ${startX},${startY} C ${cp1X},${cp1Y} ${cp2X},${cp2Y} ${endX},${endY}`)
    }

    const obs = new ResizeObserver(updatePath)
    if (containerRef.current) obs.observe(containerRef.current)
    updatePath()
    return () => obs.disconnect()
  }, [containerRef, fromRef, toRef, curvature, startXOffset, startYOffset, endXOffset, endYOffset])

  return (
      <svg
          fill="none"
          width={svgDimensions.width}
          height={svgDimensions.height}
          viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
          xmlns="http://www.w3.org/2000/svg"
          className={cn("pointer-events-none absolute inset-0 transform-gpu", className)}
      >
        {/* Static line */}
        <path
            d={pathD}
            stroke={pathColor}
            strokeWidth={pathWidth}
            strokeOpacity={pathOpacity}
            strokeLinecap="round"
            strokeLinejoin="round"
        />

        {/* Animated gradient beam */}
        <motion.path
            d={pathD}
            stroke={`url(#${id})`}
            strokeWidth={pathWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              delay,
              duration: 0.2,
              ease: [0.16, 1, 0.3, 1],
              repeat: Infinity,
              repeatDelay: 1, // pause at visible state before restarting
            }}
        />

        <defs>
          <motion.linearGradient
              id={id}
              gradientUnits="userSpaceOnUse"
              initial={{ x1: "0%", x2: "0%", y1: "0%", y2: "0%" }}
              animate={{
                x1: gradientCoordinates.x1,
                x2: gradientCoordinates.x2,
                y1: gradientCoordinates.y1,
                y2: gradientCoordinates.y2,
              }}
              transition={{
                delay,
                duration,
                ease: [0.16, 1, 0.3, 1],
                repeat: Infinity,
                repeatDelay: 1,
              }}
          >
            <stop stopColor={gradientStartColor} stopOpacity="0" />
            <stop stopColor={gradientStartColor} />
            <stop offset="32.5%" stopColor={gradientStopColor} />
            <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
          </motion.linearGradient>
        </defs>
      </svg>
  )
}