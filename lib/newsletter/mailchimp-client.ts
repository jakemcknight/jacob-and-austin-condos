import type { MailchimpCampaign } from "./types";

function getAuthHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
    "Content-Type": "application/json",
  };
}

function getBaseUrl(apiKey: string): string {
  const dc = apiKey.split("-").pop();
  return `https://${dc}.api.mailchimp.com/3.0`;
}

export async function fetchSentCampaigns(
  apiKey: string,
  listId: string
): Promise<MailchimpCampaign[]> {
  const baseUrl = getBaseUrl(apiKey);
  const headers = getAuthHeaders(apiKey);
  const allCampaigns: MailchimpCampaign[] = [];
  let offset = 0;
  const count = 100;

  while (true) {
    const url = `${baseUrl}/campaigns?status=sent&sort_field=send_time&sort_dir=DESC&count=${count}&offset=${offset}&list_id=${listId}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Mailchimp API error: ${err.title} - ${err.detail}`);
    }

    const data = await res.json();
    const campaigns: MailchimpCampaign[] = data.campaigns || [];
    allCampaigns.push(...campaigns);

    if (allCampaigns.length >= data.total_items || campaigns.length < count) {
      break;
    }
    offset += count;
  }

  return allCampaigns;
}

export async function fetchCampaignContent(
  apiKey: string,
  campaignId: string
): Promise<string> {
  const baseUrl = getBaseUrl(apiKey);
  const headers = getAuthHeaders(apiKey);

  const res = await fetch(`${baseUrl}/campaigns/${campaignId}/content`, {
    headers,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(
      `Mailchimp content error for ${campaignId}: ${err.title} - ${err.detail}`
    );
  }

  const data = await res.json();
  return data.html;
}
