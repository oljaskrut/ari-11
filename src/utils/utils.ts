export const safeParseJSON = (str: string) => {
  try {
    return JSON.parse(str)
  } catch (error) {
    return null
  }
}

export const timestamp = () => {
  return ~~(Date.now() / 1000)
}

export const delay = (ms = 1000) => new Promise((resolve) => setTimeout(resolve, ms))
