export const createPaginationState = (pagination = {}) => ({
  strategy: pagination.strategy,
  page: 1,
  offset: 0,
  cursor: null,
  done: false,
})

export const hasPaginationContinuation = value => typeof value === 'string'
  ? !['', '0', 'false'].includes(value.trim().toLowerCase()) : Boolean(value)

const buildPaginationRequest = (pagination = {}, params = {}) => (
  pagination.pageParamLocation === 'body'
    ? { query: {}, body: params }
    : { query: params }
)

export const getNextPageRequest = (config, state) => {
  if (state.done) return null

  if (state.strategy === 'single-page') {
    return state.page === 1 ? { query: {} } : null
  }

  if (state.strategy === 'offset-limit') {
    return buildPaginationRequest(config.pagination, {
      [config.pagination.offsetParam || 'offset']: state.offset,
      [config.pagination.limitParam || 'limit']: config.pagination.pageSize,
    })
  }

  if (state.strategy === 'page-number') {
    return buildPaginationRequest(config.pagination, {
      [config.pagination.pageParam || 'page']: state.page,
    })
  }

  return buildPaginationRequest(config.pagination, { page: state.page })
}

export const updatePaginationState = (pagination, state, pageInfo = {}) => {
  if (pagination.strategy === 'offset-limit') {
    const pageSize = pageInfo.pageSize || pagination.pageSize || 0
    const nextOffset = state.offset + pageSize
    const totalCount = pageInfo.totalCount
    const resultCount = pageInfo.resultCount ?? 0
    const hasExplicitHasMorePath = Boolean(pagination.hasMorePath)
    const hasMore = hasExplicitHasMorePath
      ? hasPaginationContinuation(pageInfo.hasMore)
      : totalCount != null
        ? nextOffset < totalCount
        : resultCount === pageSize && resultCount > 0

    return {
      ...state,
      offset: nextOffset,
      done: !hasMore,
    }
  }

  if (pagination.strategy === 'page-number') {
    const pageSize = pageInfo.pageSize || pagination.pageSize || 0
    const totalCount = pageInfo.totalCount
    const resultCount = pageInfo.resultCount ?? 0
    const hasExplicitHasMorePath = Boolean(pagination.hasMorePath)
    const hasMore = hasExplicitHasMorePath
      ? hasPaginationContinuation(pageInfo.hasMore)
      : totalCount != null
        ? state.page * pageSize < totalCount
        : resultCount === pageSize && resultCount > 0

    return {
      ...state,
      page: state.page + 1,
      done: !hasMore,
    }
  }

  return {
    ...state,
    page: state.page + 1,
    done: !hasPaginationContinuation(pageInfo.hasMore),
  }
}
