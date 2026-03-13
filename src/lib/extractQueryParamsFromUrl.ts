type ExtractedQueryParam = {
    key: string;
    value: string;
    enabled: true;
};

type ExtractQueryParamsSuccess = {
    ok: true;
    params: ExtractedQueryParam[];
};

type ExtractQueryParamsFailure = {
    ok: false;
    error: string;
};

type ExtractQueryParamsResult = ExtractQueryParamsSuccess | ExtractQueryParamsFailure;

function parseUrl(rawUrl: string): URL | null {
    try {
        return new URL(rawUrl);
    } catch {
        return null;
    }
}

export function extractQueryParamsFromUrl(rawUrl: string): ExtractQueryParamsResult {
    const trimmedUrl = rawUrl.trim();
    if (trimmedUrl.length === 0) {
        return { ok: false, error: 'URL is empty' };
    }

    let parsedUrl = parseUrl(trimmedUrl);
    if (!parsedUrl && !/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedUrl)) {
        parsedUrl = parseUrl(`https://${trimmedUrl}`);
    }

    if (!parsedUrl) {
        return { ok: false, error: 'Unable to parse URL' };
    }

    const params: ExtractedQueryParam[] = [];
    parsedUrl.searchParams.forEach((value, key) => {
        params.push({ key, value, enabled: true });
    });

    return { ok: true, params };
}