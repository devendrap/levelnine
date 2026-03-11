import {
  JWT_SECRET as _JWT_SECRET,
  JWT_EXPIRES_IN as _JWT_EXPIRES_IN,
} from 'astro:env/server'

export const JWT_SECRET: string = _JWT_SECRET
export const JWT_EXPIRES_IN: string = _JWT_EXPIRES_IN
