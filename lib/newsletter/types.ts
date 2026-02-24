export interface NewsletterMeta {
  slug: string;
  campaignId: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  author: string;
  tags: string[];
  keywords: string[];
  thumbnail: string;
  category: "newsletter";
  status: "published";
  readingTime: number;
}

export interface NewsletterManifest {
  lastSyncedAt: string;
  campaigns: {
    [campaignId: string]: {
      slug: string;
      syncedAt: string;
      sendTime: string;
    };
  };
}

export interface CleanedHtml {
  html: string;
  images: Array<{ remoteUrl: string; localPath: string }>;
  textContent: string;
  inThisIssue: string; // Extracted "In This Issue" subtitle text
  sharingAMomentImage: string; // Local path of the "Sharing a Moment" image
}

export interface MailchimpCampaign {
  id: string;
  send_time: string;
  settings: {
    subject_line: string;
    preview_text: string;
  };
  recipients: {
    list_id: string;
  };
}
