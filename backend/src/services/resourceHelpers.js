import { optionalString, pagination, queryBoolean } from '../utils/validation.js';

export function listFilters(query, { forceActive = false } = {}) {
  const paging = pagination(query);
  const search = optionalString(query.search, 'search', { max: 120 }) ?? '';
  const escaped = search.replace(/[\\%_]/g, '\\$&');
  return {
    ...paging,
    active: forceActive ? true : queryBoolean(query.active),
    term: search,
    pattern: `%${escaped}%`,
  };
}

export function paginated(result, filters) {
  return {
    data: result.items,
    meta: { page: filters.page, limit: filters.limit, total: result.total },
  };
}
