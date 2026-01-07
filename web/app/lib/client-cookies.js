export function getCookie(name) {
  if (typeof document === "undefined") {
    return "";
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export function setCookie(name, value) {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${name}=${value}; path=/`;
}

export function deleteCookie(name) {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${name}=; path=/; max-age=0`;
}
