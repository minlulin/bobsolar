import { Variants } from 'framer-motion';

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0 },
};

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, y: -20 },
};

export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
};

export const slideInRight: Variants = {
  initial: { x: '100%' },
  animate: { x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { x: '100%' },
};

export const glowPulse: Variants = {
  animate: {
    boxShadow: [
      '0 0 0px 0px rgba(245, 158, 11, 0)',
      '0 0 20px 5px rgba(245, 158, 11, 0.4)',
      '0 0 0px 0px rgba(245, 158, 11, 0)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};
