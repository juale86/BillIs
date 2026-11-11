/** "1:23 a. m." → "1:23am" (algunos teléfonos escriben a. m. / p. m.). */
export const amPm = (s: string) => s.replace(/\s*([ap])\.\s*m\./gi, (_, l: string) => l.toLowerCase() + 'm')
