import {ApiError, ApiErrorDetail, ResponseEnvelope, ResponsePaginationBuilder} from "@potentii/rest-envelopes";

/**
 * @package
 */
export default class PaginationUtils{


	static paginationQueryMiddleware(req, res, next){
		if(req.query.page?.trim()?.length && (Number.isNaN(Number(req.query.page)) || !Number.isSafeInteger(Number(req.query.page))))
			return res.status(400)
				.json(ResponseEnvelope.withError(ApiError.create(`INVALID_PAGINATION`, `Invalid pagination`, ApiErrorDetail.create(`INVALID_PAGE`, `Invalid page`, `query:page`, req.query.page))))
				.end();

		if(req.query.pageSize?.trim()?.length && (Number.isNaN(Number(req.query.pageSize)) || !Number.isSafeInteger(Number(req.query.pageSize))))
			return res.status(400)
				.json(ResponseEnvelope.withError(ApiError.create(`INVALID_PAGINATION`, `Invalid pagination`, ApiErrorDetail.create(`INVALID_PAGE_SIZE`, `Invalid page size`, `query:pageSize`, req.query.pageSize))))
				.end();

		const page = req.query.page?.trim()?.length ? Number(req.query.page) : undefined;
		const pageSize = req.query.pageSize?.trim()?.length ? Number(req.query.pageSize) : undefined;

		if(pageSize !== undefined && page === undefined)
			return res.status(400)
				.json(ResponseEnvelope.withError(ApiError.create(`INVALID_PAGINATION`, `Invalid pagination`, ApiErrorDetail.create(`INVALID_PAGE`, `Invalid page`, `query:page`, req.query.page))))
				.end();

		if(page !== undefined && pageSize === undefined)
			return res.status(400)
				.json(ResponseEnvelope.withError(ApiError.create(`INVALID_PAGINATION`, `Invalid pagination`, ApiErrorDetail.create(`INVALID_PAGE_SIZE`, `Invalid page size`, `query:pageSize`, req.query.pageSize))))
				.end();

		res.locals.page = page;
		res.locals.pageSize = pageSize;
		res.locals.hasPagination = page !== undefined && pageSize !== undefined;

		next();
	}


	/**
	 *
	 * @template T
	 * @param {T[]} items
	 * @param {number} page
	 * @param {number} pageSize
	 * @param {number} [zeroIndex=0]
	 * @return {{ pagination: ResponsePagination, paginatedItems: T[] }}
	 */
	static paginateWithSplit(items, page, pageSize, zeroIndex = 0){
		let fromIndex = zeroIndex + (page*pageSize);
		let toIndex = zeroIndex + (page*pageSize) + pageSize;

		// *Clamping:
		fromIndex = fromIndex < 0 ? 0 : fromIndex;
		toIndex = toIndex < 1 ? 1 : toIndex;
		fromIndex = fromIndex >= items.length-1 ? items.length-1 : fromIndex;
		toIndex = toIndex >= items.length ? items.length : toIndex;

		const pagination = ResponsePaginationBuilder.create()
			.withPage(page)
			.withPageSize(pageSize)
			.withActualPageSize(toIndex - fromIndex)
			.withPages(items.length == 0 ? 0 : Math.ceil(items.length/pageSize))
			.withTotalSize(items.length)
			.build();

		return {
			pagination: pagination,
			paginatedItems: items.slice(fromIndex, toIndex),
		};
	}




}