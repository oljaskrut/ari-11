export const safeParseJSON = (str: string) => {
  try {
    return JSON.parse(str)
  } catch (error) {
    return null
  }
}
