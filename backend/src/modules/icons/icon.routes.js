'use strict'
const { Router } = require('express')
const ctrl       = require('./icon.controller')
const uploadCtrl = require('./upload.controller')
const upload     = require('../../middleware/upload.middleware')

const router = Router()

// Icon CRUD
router.get('/',               ctrl.listIcons)
router.get('/categories',     ctrl.listCategories)
router.get('/:id',            ctrl.getIcon)
router.get('/:id/svg',        ctrl.getIconSvg)
router.get('/:id/signed-url', ctrl.refreshSignedUrl)
router.delete('/:id',         ctrl.deleteIcon)

// Upload
router.post('/upload',            upload.single('file'), uploadCtrl.uploadIcon)
router.post('/upload/svg-string', uploadCtrl.uploadIconFromString)

module.exports = router
