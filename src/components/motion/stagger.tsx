'use client';
import { motion, type HTMLMotionProps } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } } };

export function Stagger({ children, ...rest }: HTMLMotionProps<'div'>) {
  return <motion.div variants={container} initial="hidden" animate="show" {...rest}>{children}</motion.div>;
}
export function StaggerItem({ children, ...rest }: HTMLMotionProps<'div'>) {
  return <motion.div variants={item} {...rest}>{children}</motion.div>;
}
