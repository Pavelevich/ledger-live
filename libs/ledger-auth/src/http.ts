import { WalletAuthHttpError } from "./errors";

export async function postJson<Res>(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<Res> {
  return post<Res>(url, "application/json", JSON.stringify(body), headers);
}

export async function postForm<Res>(url: string, params: URLSearchParams): Promise<Res> {
  return post<Res>(url, "application/x-www-form-urlencoded", params.toString());
}

async function post<Res>(
  url: string,
  contentType: string,
  body: string,
  headers?: Record<string, string>,
): Promise<Res> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": contentType,
      ...headers,
    },
    body,
  });

  if (!response.ok) {
    throw new WalletAuthHttpError(
      `Auth HTTP error ${response.status}: ${response.statusText} - ${await response.text().catch(() => "")}`,
      response.status,
    );
  }

  return (await response.json()) as Res;
}
