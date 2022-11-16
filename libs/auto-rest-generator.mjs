import PaginationUtils from "./pagination-utils.mjs";
import {
    ApiError,
    ApiErrorDetail,
    RequestEnvelope,
    ResponseEnvelope,
    ResponseEnvelopeBuilder
} from "@potentii/rest-envelopes";



/**
 * @template T
 */
export default class AutoRestGenerator {
    /**
     * @type {express.Router}
     */
    #router;
    /**
     * @type {string}
     */
    #entityIdNameOnUrl;
    /**
     * @type {SortableField<T>[]}
     */
    #sortableFields = [];
    /**
     * @type {ApiFilter<T>[]}
     */
    #filters = [];
    /**
     * @type {(entity:T) => Promise<T>}
     */
    #createEntityFn;
    /**
     * @type {(entity:T) => Promise<T>}
     */
    #updateEntityFn;
    /**
     * @type {(id:*) => Promise<T>}
     */
    #getEntityByIdFn;
    /**
     * @type {() => Promise<T[]>}
     */
    #getAllEntitiesFn;
    /**
     * @type {(id:*) => Promise<void>}
     */
    #deleteEntityByIdFn;



    /**
     *
     * @param {express.Router} router
     * @hideconstructor
     */
    constructor(router) {
        this.#router = router;
    }



    /**
     *
     * @param {express.Router} router
     * @return {AutoRestGenerator}
     */
    static givenRouter(router){
        return new AutoRestGenerator(router);
    }


    /**
     *
     * @param {string} entityIdNameOnUrl
     * @return {AutoRestGenerator}
     */
    entityIdNameOnUrl(entityIdNameOnUrl){
        this.#entityIdNameOnUrl = entityIdNameOnUrl;
        return this;
    }

    /**
     *
     * @param {SortableField<T>} sortableField
     * @return {AutoRestGenerator}
     */
    sortableField(sortableField){
        this.#sortableFields.push(sortableField);
        return this;
    }

    /**
     *
     * @param {ApiFilter<T>} filter
     * @return {AutoRestGenerator}
     */
    filter(filter){
        this.#filters.push(filter);
        return this;
    }

    /**
     *
     * @param {(entity:T) => Promise<T>} createEntityFn
     * @return {AutoRestGenerator}
     */
    createEntityFn(createEntityFn){
        this.#createEntityFn = createEntityFn;
        return this;
    }

    /**
     *
     * @param {(entity:T) => Promise<T>} updateEntityFn
     * @return {AutoRestGenerator}
     */
    updateEntityFn(updateEntityFn){
        this.#updateEntityFn = updateEntityFn;
        return this;
    }

    /**
     *
     * @param {(id:*) => Promise<T>} getEntityByIdFn
     * @return {AutoRestGenerator}
     */
    getEntityByIdFn(getEntityByIdFn){
        this.#getEntityByIdFn = getEntityByIdFn;
        return this;
    }

    /**
     *
     * @param {() => Promise<T[]>} getAllEntitiesFn
     * @return {AutoRestGenerator}
     */
    getAllEntitiesFn(getAllEntitiesFn){
        this.#getAllEntitiesFn = getAllEntitiesFn;
        return this;
    }

    /**
     *
     * @param {(id:*) => Promise<void>} deleteEntityByIdFn
     * @return {AutoRestGenerator}
     */
    deleteEntityByIdFn(deleteEntityByIdFn){
        this.#deleteEntityByIdFn = deleteEntityByIdFn;
        return this;
    }


    /**
     * Generates the CRUD for this entity
     */
    generate(){

        const reservedQueryParams = ['sortBy', 'sortDir', 'page', 'pageSize'];


        this.#router.get(`/`, PaginationUtils.paginationQueryMiddleware, async (req, res, next) => {
            let entities = await this.#getAllEntitiesFn();
            const responseBuilder = ResponseEnvelopeBuilder.create();


            // *Sorting:
            const sortBy = req.query.sortBy;
            const sortDir = req.query.sortDir === 'DESC' ? 'DESC' : 'ASC';
            if(sortBy){
                const sortField = this.#sortableFields.find(f => f.fieldName == sortBy);
                if(!sortField)
                    return res.status(400)
                        .json(ResponseEnvelope.withError(ApiError.create(`INVALID_SORTING`, `Invalid sorting`, [ ApiErrorDetail.create(`UNSUPPORTED_SORTING_FIELD`, `Cannot sort by the provided field`, `query:sortBy`, sortBy) ])))
                        .end();
                if(sortDir == 'DESC')
                    entities.sort((entity1, entity2) => sortField.makeSortableFn(entity2) - sortField.makeSortableFn(entity1));
                else
                    entities.sort((entity1, entity2) => sortField.makeSortableFn(entity1) - sortField.makeSortableFn(entity2));
            }


            // *Filtering:
            const requestedFilters = Object.entries(req.query)
                .filter(qsEntry => !reservedQueryParams.includes(qsEntry[0]))
                .map(qsEntry => ({
                    filterConfig: this.#filters.find(f => f.filterName == qsEntry[0]),
                    name: qsEntry[0],
                    value: qsEntry[1]
                }));
            const invalidFilters = requestedFilters.filter(f => !f.filterConfig);
            if(invalidFilters.length){
                return res.status(400)
                    .json(ResponseEnvelope.withError(ApiError.create(`INVALID_FILTER`, `Invalid filter`, invalidFilters.map(invalidFilter => ApiErrorDetail.create(`INVALID_FILTER`, `Invalid filter`, `query`, invalidFilter.name)))))
                    .end();
            }
            for (let requestedFilter of requestedFilters) {
                entities = entities.filter((item, index, items) => requestedFilter.filterConfig.filterFn(requestedFilter.value, item, index, items));
            }


            // *Zeroing:
            const zeroId = req.query.zeroId;
            let zeroIndex = 0;
            if(zeroId){
                zeroIndex = entities.findIndex(entity => entity.id == zeroId);
                if(zeroIndex < 0)
                    return res.status(400)
                        .json(ResponseEnvelope.withError(ApiError.create(`ZEROID_NOT_FOUND`, `Zero ID could not be found`, [ ApiErrorDetail.create(`ZEROID_NOT_FOUND`, `Zero ID could not be found after filtering`, `query:zeroId`, zeroId) ])))
                        .end();
            }


            // *Pagination:
            const page = res.locals.page;
            const pageSize = res.locals.pageSize;
            const hasPagination = res.locals.hasPagination;
            if(hasPagination){
                const result = PaginationUtils.paginateWithSplit(entities, page, pageSize, zeroIndex);
                entities = result.paginatedItems;
                responseBuilder.withPagination(result.pagination);
            }


            responseBuilder.withData(entities);


            res.status(200)
                .json(responseBuilder.build())
                .end();
        });



        this.#router.get(`/:${this.#entityIdNameOnUrl}`, async (req, res, next) => {
            const id = req.params[this.#entityIdNameOnUrl];

            const found = await this.#getEntityByIdFn(id);

            if(!found)
                return res.status(404)
                    .json(ResponseEnvelope.withError(ApiError.create(`NOT_FOUND`, `Entity not found`, null)))
                    .end();

            res.status(200)
                .json(ResponseEnvelope.withData(found))
                .end();
        });



        this.#router.post(`/`, async (req, res, next) => {
            const newEntity = RequestEnvelope.from(req.body)?.data;

            if(newEntity?.id)
                return res.status(400)
                    .json(ResponseEnvelope.withError(ApiError.create(`INVALID_ENTITY`, `Invalid entity`, [ ApiErrorDetail.create(`NEW_ENTITY_WITH_ID`, `New entities must have an ID set`, `id`, newEntity.id) ])))
                    .end();

            const savedEntity = await this.#createEntityFn(newEntity);

            res.status(201)
                .json(ResponseEnvelope.withData(savedEntity))
                .end();
        });



        this.#router.put(`/:${this.#entityIdNameOnUrl}`, async (req, res, next) => {
            const id = req.params[this.#entityIdNameOnUrl];
            const entityToUpdate = RequestEnvelope.from(req.body)?.data;

            if(entityToUpdate?.id !== id)
                return res.status(400)
                    .json(ResponseEnvelope.withError(ApiError.create(`INVALID_ID`, `Invalid ID`, [ ApiErrorDetail.create(`ID_MISMATCH`, `Id from the entity and from the path are not the same`, `id`, entityToUpdate.id) ])))
                    .end();

            if(!entityToUpdate?.id)
                return res.status(400)
                    .json(ResponseEnvelope.withError(ApiError.create(`INVALID_ENTITY`, `Invalid entity`, [ ApiErrorDetail.create(`EDIT_ENTITY_WITHOUT_ID`, `Existing entities must have an ID set`, `id`, entityToUpdate.id) ])))
                    .end();

            const savedEntity = await this.#updateEntityFn(entityToUpdate);

            res.status(200)
                .json(ResponseEnvelope.withData(savedEntity))
                .end();
        });



        this.#router.delete(`/:${this.#entityIdNameOnUrl}`, async (req, res, next) => {
            const id = req.params[this.#entityIdNameOnUrl];

            const found = await this.#getEntityByIdFn(id);

            if(!found)
                return res.status(404)
                    .json(ResponseEnvelope.withError(ApiError.create(`NOT_FOUND`, `Entity not found`, null)))
                    .end();

            await this.#deleteEntityByIdFn(id);

            res.status(200)
                .json(ResponseEnvelope.withData(found))
                .end();
        });

    }

}