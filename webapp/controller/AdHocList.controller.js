sap.ui.define([
    "imscanning/controller/BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
        "sap/ui/core/BusyIndicator",
        "sap/m/MessageToast"
], function(BaseController, Filter, FilterOperator, Fragment, MessageBox, BusyIndicator, MessageToast) {
    "use strict";

    return BaseController.extend("imscanning.controller.AdHocList", {
        // Called when the controller is initialized
        onInit: function() {
            try {
                // Get router and attach route matched handler
                this.oRouter = this.getOwnerComponent().getRouter();
                this.oRouter.attachRouteMatched(this._onRouteMatched, this);
                // Get reference to the current view
                this._oView = this.getView();
                // Get reference to the component owning this view
                this._oComponent = sap.ui.component(sap.ui.core.Component.getOwnerIdFor(this._oView));
            } catch (e) {
                this.handleException(e);
            }
        },

        // Called when the route is matched
        _onRouteMatched: function(oEvent) {
            try {
                var obj = this._oComponent.getModel("globalDataModel").getData();
                obj.Source = oEvent.getParameter('arguments').target;
                obj.errorMessages = [];
                // Keep only WarehouseNumber in the HeaderFilter
                obj.HeaderFilter = Object.fromEntries(
                    Object.entries(obj.HeaderFilter).filter(([key]) => key === 'WarehouseNumber')
                );
                this._oComponent.getModel("globalDataModel").refresh(true);

                // Clear selections and unbind table items
                this.byId("inventoryTable").removeSelections();
                this.byId("inventoryTable").unbindItems();
                console.log("List controller : " + oEvent.getParameter("name"));

                // Load the table item fragment template
                var that = this;
                Fragment.load({
                    name: "imscanning.view.fragments.TabelTemplate",
                    controller: this
                }).then(function(oTemplate) {
                    that._oTableItemTemplate = oTemplate;
                });

                // If WarehouseNumber is available, trigger search
                if (obj.HeaderFilter.WarehouseNumber)
                    this.onSearch();
                else
                    this._fetchDefaultValues.bind(this)();
            } catch (e) {
                this.handleException(e);
            }
        },

        // Called when a scan is successful
        onScanSuccess: function(oEvent, source) {
            // try {
            //     const text = oEvent.getParameter("text");
            //     const cancelled = oEvent.getParameter("cancelled");

            //     if (cancelled) {
            //         MessageToast.show("Scan cancelled", {
            //             duration: 1000
            //         });
            //         return;
            //     }

            //     if (!text) return;

            //     const obj = this._oComponent.getModel("globalDataModel").getData();

            //     // Mapping of scan sources to paths and fields
            //     const filterConfig = {
            //         'Product': {
            //             path: "/ZEWM_I_ProductVH",
            //             key: "Product",
            //             filterKey: "Product",
            //             additionalFilters: ["WarehouseNumber", "StorageType", "StorageBin"]
            //         },
            //         'SB': {
            //             path: "/ZEWM_I_StorageBinVH",
            //             key: "StorageBin",
            //             filterKey: "StorageBin",
            //             additionalFilters: ["WarehouseNumber", "StorageType"]
            //         },
            //         'HU': {
            //             path: "/ZEWM_I_HandlingUnitTypeVH",
            //             key: "HandlingUnitType",
            //             filterKey: "HandlingUnit",
            //             additionalFilters: ["WarehouseNumber", "StorageType", "StorageBin"]
            //         },
            //         'Batch': {
            //             path: "/ZEWM_I_PhysStkBatchVH",
            //             key: "Batch",
            //             filterKey: "Batch",
            //             additionalFilters: ["WarehouseNumber", "StorageType", "StorageBin", "Product"]
            //         },
            //         'WH': {
            //             path: null,
            //             key: "WarehouseNumber",
            //             filterKey: "WarehouseNumber",
            //             additionalFilters: []
            //         }
            //     };

            //     // If no config or path, treat as direct assignment (for WH)
            //     const config = filterConfig[source];
            //     if (!config || !config.path) {
            //         if (source === 'WH') {
            //             obj.HeaderFilter.WarehouseNumber = text;
            //             this._oComponent.getModel("globalDataModel").refresh(true);
            //             this.onSearch();
            //         }
            //         return;
            //     }

            //     const filterList = [new Filter(config.key, FilterOperator.EQ, text)];

            //     // Add additional filters from HeaderFilter context
            //     config.additionalFilters.forEach(field => {
            //         const value = obj.HeaderFilter[field];
            //         if (value) {
            //             filterList.push(new Filter(field, FilterOperator.EQ, value));
            //         }
            //     });

            //     const that = this;

            //     // Validate the scan value
            //     const validateScan = () => {
            //         return new Promise((resolve, reject) => {
            //             that._validateScanValue(config.path, filterList, resolve, reject, this._getText("incorrectScan"));
            //         });
            //     };

            //     // On successful validation, update HeaderFilter and refresh
            //     const onSuccess = () => {
            //         obj.HeaderFilter[config.filterKey] = text;
            //         that._oComponent.getModel("globalDataModel").refresh(true);
            //         that._handleFilterClear.bind(this)(config.filterKey);
            //         that.onSearch();
            //     };

            //     // On failed validation, clear the field and search again
            //     const onError = () => {
            //         obj.HeaderFilter[config.filterKey] = '';
            //         that._oComponent.getModel("globalDataModel").refresh(true);
            //         that.onSearch();
            //     };

            //     validateScan().then(onSuccess).catch(onError);

            // } catch (e) {
            //     this.handleException(e);
            // }

            try {
                var that = this;
            
                // BarcodeScanner.scan(
                //     function(oResult) {
                        var text = oEvent.getParameter("text");
                        const cancelled = oEvent.getParameter("cancelled");
                        if(source === 'SB'){
                            text = "Q05" + text; 
                        }
                        if (cancelled) {
                            sap.m.MessageToast.show("Scan cancelled", { duration: 1000 });
                            return;
                        }
            
                        if (!text) return;
            
                        const obj = that._oComponent.getModel("globalDataModel").getData();
            
                        // Prefix-to-field mapping
                        const appIdMap = {
                            "240": "Product",
                            "00": "HU",
                            "Q04": "DST", 
                            "Q05": "DSB",
                            "10": "Batch"
                        };
            
                        const filterConfig = {
                            'Product': {
                                path: "/ProductVHSet",
                                key: "Product",
                                filterKey: "Product",
                                additionalFilters: ["WarehouseNumber", "StorageType", "StorageBin"]
                            },
                            'DST': {
                                path: null,
                                key: "DST",
                                filterKey: "DST",
                                additionalFilters: []
                            },
                            'DSB': {
                        path: "/StorageBinVHSet",
                        key: "StorageBin",
                        filterKey: "StorageBin",
                        additionalFilters: ["WarehouseNumber", "StorageType"]
                            },
                            'HU': {
                                path: "/HandlingUnitVHSet",
                                key: "HandlingUnitNumber",
                                filterKey: "HandlingUnit",
                                additionalFilters: ["WarehouseNumber", "StorageType", "StorageBin"]
                            },
                            'Batch': {
                                path: "/BatchVHSet",
                                key: "Batch",
                                filterKey: "Batch",
                                additionalFilters: ["WarehouseNumber", "StorageType", "StorageBin", "Product"]
                            },
                            'WH': {
                                path: null,
                                key: "WarehouseNumber",
                                filterKey: "WarehouseNumber",
                                additionalFilters: []
                            }
                        };
            
                        // Sort keys by length descending to match longest first
                        const sortedKeys = Object.keys(appIdMap).sort((a, b) => b.length - a.length);
            
                        // Helper to parse prefix
                        function getFieldByAppIdentifier(inputText) {
                            for (const key of sortedKeys) {
                                if (inputText.startsWith(key)) {
                                    return {
                                        field: appIdMap[key],
                                        value: inputText.slice(key.length)
                                    };
                                }
                            }
                            return null;
                        }
            
                        // Split by '#' and process each scanned part
                        const parts = text.split('#');
            
                        parts.forEach((part) => {
                            const parsed = getFieldByAppIdentifier(part);
                            if (!parsed) {
                                console.warn("Unrecognized scanned part: " + part);
                                return;
                            }
            
                            const source = parsed.field;
                            const scannedValue = parsed.value;
            
                            const config = filterConfig[source];
            
                            // If config not defined, skip
                            if (!config) {
                                console.warn("No config for scanned field: " + source);
                                return;
                            }
            
                            // If no path (like WH), assign directly
                            if (!config.path) {
                                obj.HeaderFilter[config.filterKey] = scannedValue;
                                that._oComponent.getModel("globalDataModel").refresh(true);
                                that.onSearch();
                                return;
                            }
            
                            // Build filters
                            const filterList = [new Filter(config.key, FilterOperator.EQ, scannedValue)];
            
                            config.additionalFilters.forEach(field => {
                                const value = obj.HeaderFilter[field];
                                if (value) {
                                    filterList.push(new Filter(field, FilterOperator.EQ, value));
                                }
                            });
            
                            // Validate scanned value
                            const validateScan = () => {
                                return new Promise((resolve, reject) => {
                                    that._validateScanValue(
                                        config.path,
                                        filterList,
                                        resolve,
                                        reject,
                                        that._getText("incorrectScan")
                                    );
                                });
                            };
            
                            const onSuccess = () => {
                                obj.HeaderFilter[config.filterKey] = scannedValue;
                                that._oComponent.getModel("globalDataModel").refresh(true);
                                that._handleFilterClear(config.filterKey);
                                that.onSearch();
                            };
            
                            const onError = () => {
                                obj.HeaderFilter[config.filterKey] = '';
                                that._oComponent.getModel("globalDataModel").refresh(true);
                                that.onSearch();
                            };
            
                            validateScan().then(onSuccess).catch(onError);
                        });
                //     },
                //     function(oError) {
                //         sap.m.MessageToast.show("Scan failed: " + oError);
                //     }
                // );
            } catch (e) {
                this.handleException(e);
            }
        },

        // Called when a scan fails
        onScanError: function(oEvent) {
            try {
                MessageToast.show("Scan failed: " + oEvent, {
                    duration: 1000
                });
            } catch (e) {
                this.handleException(e);
            }
        },

        onScanLiveupdate: function(oEvent) {
            try {
                
            } catch (e) {
                this.handleException(e);
            }
        },

        // Triggered when the Move button is pressed
        onMovePress: function() {
            try {

                // Get the table by its ID
                var oTable = this.byId("inventoryTable");

                // Get selected items
                var aSelectedItems = oTable.getSelectedItems();
                if (aSelectedItems.length === 0) {
                    var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                    MessageBox.warning(
                        this._getText("NoItemMoveWarning"), {
                            styleClass: bCompact ? "sapUiSizeCompact" : ""
                        }
                    );
                    return;
                }

                // Array to hold selected item data
                var aSelectedData = [];

                // Loop through selected items and get their binding context data
                aSelectedItems.forEach(function(oItem) {
                    var oContext = oItem.getBindingContext();
                    if (oContext) {
                        aSelectedData.push(oContext.getObject());
                    }
                });

                var obj = this._oComponent.getModel("globalDataModel").getData();
                obj.selectedItems = aSelectedData;
                obj.ActiveItem = aSelectedData[0];
                this._oComponent.getModel("globalDataModel").refresh(true);
                if(obj.Source === 'Stock Type'){
                    this._openStockTypeChangeDialog.bind(this)();
                    return;
                }
                var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                // oRouter.navTo("RouteAdHocItem");
                oRouter.navTo("RouteAdHocItem", {
                    target: obj.Source
                });
            } catch (e) {
                this.handleException(e);
            }
        },

        // Move a single item directly from list
        onMoveItem: function(oEvent) {
            var obj = this._oComponent.getModel("globalDataModel").getData(),
                aSelectedData = [];
            aSelectedData.push(oEvent.getSource().getParent().getBindingContext().getObject());
            obj.selectedItems = aSelectedData;
            obj.ActiveItem = aSelectedData[0];
            this._oComponent.getModel("globalDataModel").refresh(true);
            if(obj.Source === 'Stock Type'){
                this._openStockTypeChangeDialog.bind(this)();
                return;
            }
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            // oRouter.navTo("RouteAdHocItem");
            oRouter.navTo("RouteAdHocItem", {
                target: obj.Source
            });
        },
        // When value help dialog confirms a selection
        onValueHelpConfirm: function(oEvent, source) {
            try {
                var obj = this._oComponent.getModel("globalDataModel").getData();
                // Set selected value in HeaderFilter based on source
                switch (source) {
                    case 'WH':
                        obj.HeaderFilter.WarehouseNumber = oEvent.getParameter("selectedItem").getTitle();
                        obj.HeaderFilter = Object.fromEntries(
                            Object.entries(obj.HeaderFilter).filter(([key]) => key === 'WarehouseNumber')
                        );
                        break;
                    case 'Product':
                        obj.HeaderFilter.Product = oEvent.getParameter("selectedItem").getTitle();
                        break;
                    case 'SB':
                        obj.HeaderFilter.StorageBin = oEvent.getParameter("selectedItem").getTitle();
                        break;
                    case 'HU':
                        obj.HeaderFilter.HandlingUnit = oEvent.getParameter("selectedItem").getTitle();
                        break;
                    case 'ST':
                        obj.HeaderFilter.StorageType = oEvent.getParameter("selectedItem").getTitle();
                        break;
                    case 'Stock Type':
                        obj.HeaderFilter.StockType = oEvent.getParameter("selectedItem").getTitle();
                        break;
                        case 'Stock Type Target':
                            obj.TargetData.StockType = oEvent.getParameter("selectedItem").getTitle();
                            break;
                    case 'Batch':
                        obj.HeaderFilter.Batch = oEvent.getParameter("selectedItem").getTitle();
                        break;
                }
                this._oComponent.getModel("globalDataModel").refresh(true);
                this._handleFilterClear.bind(this)(source);
                this.onSearch.bind(this)();
            } catch (e) {
                this.handleException(e);
            }
        },

        // Triggers the search using filters in HeaderFilter
        onSearch: function() {
            try {
                var oTable = this.byId("inventoryTable"),
                    aFilter = [],
                    oFilter = {},
                    oTemplate = this._oTableItemTemplate;
                var obj = this._oComponent.getModel("globalDataModel").getData();
                if (!obj.HeaderFilter.WarehouseNumber) {
                    var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                    MessageBox.error(
                        this._getText("WHMandatory"), {
                            styleClass: bCompact ? "sapUiSizeCompact" : ""
                        }
                    );
                    return;
                }

                // Build filters from HeaderFilter fields
                if (obj.HeaderFilter.WarehouseNumber) {
                    oFilter = new Filter("WarehouseNumber", FilterOperator.EQ, obj.HeaderFilter.WarehouseNumber);
                    aFilter.push(oFilter);
                }
                if (obj.HeaderFilter.StorageType) {
                    oFilter = new Filter("StorageType", FilterOperator.EQ, obj.HeaderFilter.StorageType);
                    aFilter.push(oFilter);
                }
                if (obj.HeaderFilter.StorageBin) {
                    oFilter = new Filter("StorageBin", FilterOperator.EQ, obj.HeaderFilter.StorageBin);
                    aFilter.push(oFilter);
                }
                if (obj.HeaderFilter.Product) {
                    oFilter = new Filter("Product", FilterOperator.EQ, obj.HeaderFilter.Product);
                    aFilter.push(oFilter);
                }
                if (obj.HeaderFilter.HandlingUnit) {
                    oFilter = new Filter("HandlingUnit", FilterOperator.EQ, obj.HeaderFilter.HandlingUnit);
                    aFilter.push(oFilter);
                }
                if (obj.HeaderFilter.StockType) {
                    oFilter = new Filter("StockType", FilterOperator.EQ, obj.HeaderFilter.StockType);
                    aFilter.push(oFilter);
                }
                if (obj.HeaderFilter.Batch) {
                    oFilter = new Filter("Batch", FilterOperator.EQ, obj.HeaderFilter.Batch);
                    aFilter.push(oFilter);
                }

                // Bind items to the table with filters
                oTable.bindItems({
                    path: "/ZSCM_C_ADHOCMOVEMENT",
                    template: oTemplate,
                    filters: aFilter
                });
            } catch (e) {
                this.handleException(e);
            }
        },

        // Clears dependent fields when a parent field is updated
        _handleFilterClear: function(source) {
            try {
                var obj = this._oComponent.getModel("globalDataModel").getData();
                switch (source) {
                    case 'Product':
                        obj.HeaderFilter.Batch = "";
                        break;
                    case 'SB':
                        obj.HeaderFilter.Batch = "";
                        obj.HeaderFilter.HandlingUnit = "";
                        obj.HeaderFilter.Product = "";
                        break;
                    case 'StorageBin':
                        obj.HeaderFilter.Batch = "";
                        obj.HeaderFilter.HandlingUnit = "";
                        obj.HeaderFilter.Product = "";
                        break;
                    case 'HU':
                        break;
                    case 'ST':
                        obj.HeaderFilter.Batch = "";
                        obj.HeaderFilter.HandlingUnit = "";
                        obj.HeaderFilter.Product = "";
                        obj.HeaderFilter.StorageBin = "";
                        break;
                    case 'Stock Type':
                        break;
                    case 'Batch':
                        break;
                }
                this._oComponent.getModel("globalDataModel").refresh(true);
            } catch (e) {
                this.handleException(e);
            }
        },

        onNavBack: function(){
            var obj = this._oComponent.getModel("globalDataModel").getData();
                obj.HeaderFilter = {};
                this._oComponent.getModel("globalDataModel").refresh(true);   
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteHome");
        },

        onModifyPress: function(oEvent){
            try {

                // Get the table by its ID
                var oTable = this.byId("inventoryTable");

                // Get selected items
                var aSelectedItems = oTable.getSelectedItems();
                if (aSelectedItems.length === 0) {
                    var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                    MessageBox.warning(
                        this._getText("NoItemModifyWarning"), {
                            styleClass: bCompact ? "sapUiSizeCompact" : ""
                        }
                    );
                    return;
                }

                // aEmployees.every(emp => emp.department === aEmployees[0].department);
                var aSelectedData = aSelectedItems.map(function(oItem) {
                    return oItem.getBindingContext().getObject();
                });
                
                var isSameStockType = aSelectedData.every(function(item) {
                    return item.StockType === aSelectedData[0].StockType;
                });
                if(!isSameStockType){
                    var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                    MessageBox.error(
                        this._getText("differentStockTypeWarning"), {
                            styleClass: bCompact ? "sapUiSizeCompact" : ""
                        }
                    );
                    return;
                }
                var obj = this._oComponent.getModel("globalDataModel").getData();
                obj.selectedItems = aSelectedData;
                obj.ActiveItem = aSelectedData[0];
                this._oComponent.getModel("globalDataModel").refresh(true);
                this._openStockTypeChangeDialog.bind(this)();

        } catch (e) {
            this.handleException(e);
        }
        },

        _openStockTypeChangeDialog: function(){
            var obj = this._oComponent.getModel("globalDataModel").getData();
            obj.TargetData = {};
            this._oComponent.getModel("globalDataModel").refresh(true);
            if(!this._valueHelpDialogSTC){
        this._valueHelpDialogSTC = sap.ui.xmlfragment("imscanning.view.fragments.StockTypeChange", this);
        this.getView().addDependent(this._valueHelpDialogSTC);
            }
        this._valueHelpDialogSTC.open();
        },

        onChangePress: function(){
            var obj = this._oComponent.getModel("globalDataModel").getData();
            if (!obj.TargetData.Quantity || !obj.TargetData.StockType) {
                var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                MessageBox.error(this._getText("mandatoryFieldMissingMsg"), {
                    styleClass: bCompact ? "sapUiSizeCompact" : ""
                });
                return;
            }
        },

        onCancelStockTypeChangePress: function(){
            this._valueHelpDialogSTC.close();
        },

        onSubmit: function(oEvent,source){
            try{
                const obj = this._oComponent.getModel("globalDataModel").getData();
                var text = oEvent.getSource().getValue();
                if(!text){
                    this.onSearch();
                    return;
                }
                // Mapping of scan sources to paths and fields
                const filterConfig = {
                    'Product': {
                        path: "/ProductVHSet",
                        key: "Product",
                        filterKey: "Product",
                        additionalFilters: ["WarehouseNumber", "StorageType", "StorageBin"]
                    },
                    'SB': {
                        path: "/StorageBinVHSet",
                        key: "StorageBin",
                        filterKey: "StorageBin",
                        additionalFilters: ["WarehouseNumber", "StorageType"]
                    },
                    'HU': {
                        path: "/HandlingUnitVHSet",
                        key: "HandlingUnitNumber",
                        filterKey: "HandlingUnit",
                        additionalFilters: ["WarehouseNumber", "StorageType", "StorageBin"]
                    },
                    'Batch': {
                        path: "/BatchVHSet",
                        key: "Batch",
                        filterKey: "Batch",
                        additionalFilters: ["WarehouseNumber", "StorageType", "StorageBin", "Product"]
                    },
                    'WH': {
                        path: "/WareHouseNumberVHSet",
                        key: "WarehouseNumber",
                        filterKey: "WarehouseNumber",
                        additionalFilters: []
                    },
                    'Stock Type': {
                        path: "/StockTypeVHSet",
                        key: "StockType",
                        filterKey: "StockType",
                        additionalFilters: []
                    },
                    'Stock Type Target': {
                        path: "/StockTypeVHSet",
                        key: "StockType",
                        filterKey: "StockTypeTarget",
                        additionalFilters: []
                    },
                    'ST': {
                        path: "/StorageTypeVHSet",
                        key: "StorageType",
                        filterKey: "StorageType",
                        additionalFilters: ["WarehouseNumber"]
                    }
                };

                // If no config or path, treat as direct assignment (for WH)
                const config = filterConfig[source];
                if (!config || !config.path) {
                    if (source === 'WH') {
                        obj.HeaderFilter.WarehouseNumber = text;
                        this._oComponent.getModel("globalDataModel").refresh(true);
                        this.onSearch();
                        return;
                    }
                }

                const filterList = [new Filter(config.key, FilterOperator.EQ, text)];

                // Add additional filters from HeaderFilter context
                config.additionalFilters.forEach(field => {
                    const value = obj.HeaderFilter[field];
                    if (value) {
                        filterList.push(new Filter(field, FilterOperator.EQ, value));
                    }
                });

                const that = this;

                // Validate the scan value
                const validateValue = () => {
                    return new Promise((resolve, reject) => {
                        that._validateScanValue(config.path, filterList, resolve, reject, this._getText("incorrectValue"));
                    });
                };

                // On successful validation, update HeaderFilter and refresh
                const onSuccess = () => {
                    if(config.filterKey !== 'StockTypeTarget'){
                    obj.HeaderFilter[config.filterKey] = text;
                    that._oComponent.getModel("globalDataModel").refresh(true);
                    that._handleFilterClear.bind(this)(config.filterKey);
                    that.onSearch();
                    }
                    else{
                        if(config.filterKey === 'StockTypeTarget'){
                            obj.TargetData[config.filterKey] = text;
                    that._oComponent.getModel("globalDataModel").refresh(true);
                        }
                    }
                };

                // On failed validation, clear the field and search again
                const onError = () => {
                    obj.HeaderFilter[config.filterKey] = '';
                    that._oComponent.getModel("globalDataModel").refresh(true);
                    if (source !== 'WH'){
                    that.onSearch();
                    }
                    else{
                        obj.HeaderFilter = Object.fromEntries(
                            Object.entries(obj.HeaderFilter).filter(([key]) => key === 'WarehouseNumber')
                        );
                        that._oComponent.getModel("globalDataModel").refresh(true);
                        that.byId("inventoryTable").removeSelections();
                        that.byId("inventoryTable").unbindItems();
                    }
                };

                validateValue().then(onSuccess).catch(onError);

            } catch (e) {
                this.handleException(e);
            }
        },

        onStockTypeChangePress: function(){
            var obj = this._oComponent.getModel("globalDataModel").getData();
                        // payload = {};
                // payload.ParentHandlingUnitUUID = obj.ActiveItem.ParentHandlingUnitUUID;
                // payload.StockItemUUID = obj.ActiveItem.StockItemUUID;
                // payload.DestinationStockType = obj.TargetData.StockType;
                // payload.Quantity = obj.TargetData.Quantity;
                // this._postService.bind(this)(payload);
                BusyIndicator.show();
                async function processSelectedItems(obj) {
                    const results = [];
                
                    for (const item of obj.selectedItems) {
                        const payload = createPayload(item,obj.TargetData);
                        try {
                            const response = await this._postService(payload); // waits for this to finish
                            results.push({
                                item,
                                status: 'success',
                                response,
                                type: 'Success',
                                title: item.WarehouseNumber + "/" + item.StorageType + " - was submitted successfully",
                                description: "Successfully updated the Stock type for \n Warehouse Order : " + item.WarehouseNumber + " \n Storage Type : " + item.StorageType + " \n Storage Bin : " + item.StorageBin + " \n Product : " + item.Product 
                            });
                        } catch (error) {
                            results.push({
                                item,
                                title: item.WarehouseNumber + "/" + item.StorageType + " - " + "Failed",
                                description: "Failed to assigned \n Warehouse Order : " + item.WarehouseNumber + " \n Storage Type : " + item.StorageType + " \n Storage Bin : " + item.StorageBin + " \n Product : " + item.Product + " \n Reason : " + extractErrorMessage(error),
                                status: 'error',
                                type: 'Error',
                                error,
                            });
                        }
                    }
                
                    return results;
                }

                function extractErrorMessage(error) {
                    let errorMessages = [];
                
                    try {
                        const responseText = error.responseText;
                
                        // Try to parse as JSON
                        const json = JSON.parse(responseText);
                        if (json?.error?.innererror?.errordetails?.length) {
                            errorMessages = json.error.innererror.errordetails.map(e => e.message);
                        } else if (json?.error?.message?.value) {
                            errorMessages.push(json.error.message.value);
                        } else {
                            errorMessages.push("Unknown JSON error structure.");
                        }
                    } catch (jsonErr) {
                        // Not JSON, try XML
                        try {
                            const parser = new DOMParser();
                            const xmlDoc = parser.parseFromString(error.responseText, "application/xml");
                
                            const message = xmlDoc.getElementsByTagName("message")[0]?.textContent || '';
                
                            if (message) {
                                errorMessages.push(`Message: ${message}`);
                            } else {
                                errorMessages.push("Unrecognized XML error format.");
                            }
                        } catch (xmlErr) {
                            errorMessages.push("Unrecognized error format.");
                        }
                    }
                
                    return errorMessages.join('\n');
                }

                function createPayload(item, TargetData) {
                    return {
                        StockItemUUID: item.StockItemUUID,
                        ParentHandlingUnitUUID: item.ParentHandlingUnitUUID,
                        DestinationStockType: TargetData.StockType,
                        Quantity: TargetData.Quantity
                    };
                }
                processSelectedItems.call(this, obj).then(results => {
                    console.log('All items processed sequentially.');
                    console.table(results);
                    obj.errorMessages = results;
                    this._oComponent.getModel("globalDataModel").refresh(true);
                    BusyIndicator.hide();
                    if (!this._errorDialog) {
                        // this._errorDialog = sap.ui.xmlfragment("imscanning.view.fragments.ErrorDialog",
                        //     this);
                        this._errorDialog = sap.ui.xmlfragment(
                            this.createId("errorDialogFragment"), // Unique fragment ID
                            "imscanning.view.fragments.ErrorDialog",
                            this
                        );
                        this.getView().addDependent(this._errorDialog);
                    }
    
                    this._errorDialog.open();
                    this._valueHelpDialogSTC.close();
                });
        },

        _postService: function(payload) {
            return new Promise((resolve, reject) => {
                try {
                    var obj = this._oComponent.getModel("globalDataModel").getData();
                    obj.errorMessages = [];
                    this._oComponent.getModel("globalDataModel").refresh(true);
        
                    var path = this._oComponent.getModel("stockUpdateModel").createKey("/StockMovementSet", {
                        StockItemUUID: payload.StockItemUUID,
                        ParentHandlingUnitUUID: payload.ParentHandlingUnitUUID
                    });
        
                    this._oComponent.getModel("stockUpdateModel").update(path, payload, {
                        success: function(data) {
                            resolve(data); // resolve on success
                        }.bind(this),
                        error: function(error) {
                            // this.serviceCallFailureMessageHandling.bind(this)(error);
                            // BusyIndicator.hide();
                            reject(error); // reject on failure
                        }.bind(this)
                    });
        
                    console.log(path);
                } catch (e) {
                    this.handleException(e);
                    reject(e); // reject if an exception occurs
                }
            });
        },

        // _postService: function(payload) {
        //     try {
        //         var obj = this._oComponent.getModel("globalDataModel").getData()
        //         obj.errorMessages = [];
        //         this._oComponent.getModel("globalDataModel").refresh(true);
        //         // var sUrl = "/sap/opu/odata4/sap/api_warehouse_order_task_2/srvd_a2x/sap/warehouseorder/0001/WarehouseTask";
        //         // var sToken = "";
               
        //         // Fetch CSRF token
        //         // $.ajax({
        //         //     url: sUrl,
        //         //     type: "GET",
        //         //     headers: {
        //         //         "X-CSRF-Token": "Fetch"
        //         //     },
        //         //     success: function(data, textStatus, jqXHR) {
        //         //         sToken = jqXHR.getResponseHeader("X-CSRF-Token");
        //         //         // Use token to post data
        //         //         $.ajax({
        //         //             url: sUrl,
        //         //             type: "POST",
        //         //             contentType: "application/json",
        //         //             data: JSON.stringify(payload),
        //         //             headers: {
        //         //                 "X-CSRF-Token": sToken,
        //         //                 "Accept": "application/json"
        //         //             },
        //         //             success: function(response) {
        //         //                 console.log("POST success:", response);
        //         //                 BusyIndicator.hide();
        //         //                 // Success message and navigate forward
        //         //                 // var message = this._getText("warehouseOrderConfirmed", response.WarehouseOrder)
        //         //                 // MessageBox.success(message, {
        //         //                 //     actions: ["Ok"],
        //         //                 //     emphasizedAction: "Ok",
        //         //                 //     onClose: function(sAction) {
        //         //                 //         this._handlePostingSuccess.bind(this)();
        //         //                 //     }.bind(this),
        //         //                 //     dependentOn: this.getView()
        //         //                 // });
        //         //             }.bind(this),
        //         //             error: function(xhr, status, error) {
        //         //                 BusyIndicator.hide();
        //         //                 this._handlePostingFailure.bind(this)(xhr.responseText);
        //         //             }.bind(this)
        //         //         });
        //         //     }.bind(this),
        //         //     error: function(xhr, status, error) {
        //         //         BusyIndicator.hide();
        //         //         console.error("CSRF Token fetch failed:", xhr.responseText);
        //         //     }
        //         // });
        //         var path = this._oComponent.getModel("stockUpdateModel").createKey("/StockMovementSet",{
        //             StockItemUUID: payload.StockItemUUID,
        //             ParentHandlingUnitUUID: payload.ParentHandlingUnitUUID
        //         });
        //         this._oComponent.getModel("stockUpdateModel").update(path, payload,{
        //             success: function(data){
        //                 // MessageToast.show("Success");
                        
        //             }.bind(this),
        //             error: function(error){
        //                 this.serviceCallFailureMessageHandling.bind(this)(error);
        //                 // this._valueHelpDialogSTC.close();
        //                 BusyIndicator.hide();
        //             }.bind(this)
        //         })
        //         console.log(path);
        //     } catch (e) {
        //         this.handleException(e);
        //     }
        // },

        _handlePostingFailure: function(errorResponse) {
            try {
                // Parse the string to JSON
                var oError = JSON.parse(errorResponse);

                // Extract the main error message
                var mainMessage = oError.error.message;
                console.log("Main Error:", mainMessage);

                // Extract all detailed error messages
                var detailMessages = [];
                if (oError.error.details)
                    detailMessages = oError.error.details.map(function(detail) {
                        // return detail.message;
                        return {
                            type: 'Error',
                            title: detail.message
                        }
                    });
                else
                    detailMessages.push({
                        type: 'Error',
                        title: oError.error.message
                    });
                console.log("Details:", detailMessages);
                var obj = this._oComponent.getModel("globalDataModel").getData();
                obj.errorMessages = detailMessages;
                this._oComponent.getModel("globalDataModel").refresh(true);
                if (!this._errorDialog) {
                    this._errorDialog = sap.ui.xmlfragment("imscanning.view.fragments.ErrorDialog",
                        this);
                    this.getView().addDependent(this._errorDialog);
                }

                this._errorDialog.open();
            } catch (e) {
                this.handleException(e);
            }
        },
    
        onErrorDialogClose: function() {
            this._errorDialog.close(); // Close error dialog
            this.onSearch.bind(this)();
        },

        showFooter: function(source, errorMessages) {
            if (
                source === 'Stock Type' &&
                Array.isArray(errorMessages) &&
                errorMessages.some(msg => msg.status === 'error')
            ) {
                return true;
            }
            return false;
        },

        // Fetch user-specific default values (like default warehouse)
        _fetchDefaultValues: function() {
            try {
                
                var path = this._oComponent.getModel('defaultValueModel').createKey("/PersContainers", {
                    category: 'P',
                    id: 'sap.ushell.UserDefaultParameter'
                });
                this._oComponent.getModel('defaultValueModel').read(path, {
                    urlParameters: {
                        "$expand": "PersContainerItems"
                    },
                    success: function(data) {
                        if (data) {
                            if (data.PersContainerItems.results.length > 0) {
                                if (data.PersContainerItems.results.filter(item => item.id === "Warehouse").length > 0) {
                                    var obj = this._oComponent.getModel("globalDataModel").getData();
                                    obj.HeaderFilter.WarehouseNumber = JSON.parse(data.PersContainerItems.results.filter(item => item.id === "Warehouse")[0].value).value;
                                    this._oComponent.getModel("globalDataModel").refresh(true);
                                    this.onSearch.bind(this)();
                                }
                            }
                        }
                    }.bind(this),
                    error: function(error) {

                    }.bind(this)
                });
            } catch (e) {
                this.handleException(e);
            }
        }

    });
});