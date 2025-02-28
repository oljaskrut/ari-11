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
