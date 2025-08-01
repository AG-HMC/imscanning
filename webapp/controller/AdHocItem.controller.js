sap.ui.define([
        "imscanning/controller/BaseController",
        "sap/m/MessageBox",
        "sap/ui/core/BusyIndicator",
        "sap/ui/model/Filter",
        "sap/ui/model/FilterOperator"
    ], (BaseController, MessageBox, BusyIndicator, Filter, FilterOperator) => {
        "use strict";
    
        return BaseController.extend("imscanning.controller.AdHocItem", {
            onInit() {
                this.oRouter = this.getOwnerComponent().getRouter();
                this.oRouter.attachRouteMatched(this._onRouteMatched, this);
    
                // View reference
                this._oView = this.getView();
                // Component reference
                this._oComponent = sap.ui.component(sap.ui.core.Component.getOwnerIdFor(this._oView));
            },
            _onRouteMatched: function(oEvent) {
                try {
                    var obj = this._oComponent.getModel("globalDataModel").getData();
                    // Reset TargetData on every route match
                    obj.errorMessages = [];
                    obj.TargetData = {};
                    if(obj.ActiveItem){
                    if(obj.ActiveItem.SourceHandlingUnit !== '')
                        obj.TargetData.Quantity = obj.ActiveItem.Quantity;
                }
                    this._oComponent.getModel("globalDataModel").refresh(true);
                    // Redirect if route is Home
                    if (oEvent.getParameter("name") === 'RouteHome') {
                        var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                        oRouter.navTo("RouteHome");
                        return;
                    }
                    // Redirect to item list if no selected items exist
                    if (!obj.selectedItems) {
                        var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                        // oRouter.navTo("RouteAdHocList");
                        oRouter.navTo("RouteAdHocList", {
                            target: obj.Source
                        });
                        return;
                    }
                    if (obj.selectedItems.length === 0) {
                        var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                        // oRouter.navTo("RouteAdHocList");
                        oRouter.navTo("RouteAdHocList", {
                            target: obj.Source
                        });
                        return;
                    }
                    // Count how many items are not completed
                    var count = obj.selectedItems.filter(item => item.Complete !== true).length
                    const sRouteName = oEvent.getParameter("name");
                    if (count > 0) {
                        // Remove any previously registered popstate listener
                        if (this._handleBackButton) {
                            window.removeEventListener("popstate", this._handleBackButton);
                            this._handleBackButton = null;
                        }
                        // Skip if already in AdHocList
                        if (sRouteName === 'RouteAdHocList') {
                            return;
                        }
    
                        // Only push state if not already pushed
                        if (!this._hasPushedState) {
                            history.pushState({
                                fake: true
                            }, "", window.location.href);
                            this._hasPushedState = true;
                        }
    
                        // Push an extra state so the back button triggers popstate
                        // history.pushState(null, null, window.location.href);
                        history.pushState({
                            fake: true
                        }, "", window.location.href);
    
                        this._handleBackButton = (event) => {
                            // Show confirmation
                            var obj = this._oComponent.getModel("globalDataModel").getData();
                            var count = obj.selectedItems.filter(item => item.Complete !== true).length;
                            if (count === 0)
                                return;
                            // Confirm with user before navigating back
                            MessageBox.confirm("Do you really want to go back?", {
                                title: "Confirm Navigation",
                                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                                emphasizedAction: MessageBox.Action.NO,
                                onClose: function(sAction) {
                                    if (sAction === MessageBox.Action.YES) {
                                        // Remove listener and go back
                                        window.removeEventListener("popstate", this._handleBackButton);
                                        this._handleBackButton = null;
                                        var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                                        var obj = this._oComponent.getModel("globalDataModel").getData();
                                        // oRouter.navTo("RouteAdHocList");
                                        oRouter.navTo("RouteAdHocList", {
                                            target: obj.Source
                                        });
                                    } else {
                                        // Push a new fake state to keep them on same page (optional)
                                        history.pushState(null, null, location.href);
                                    }
                                }.bind(this)
                            });
                        };
                        // Add popstate event listener
                        window.addEventListener("popstate", this._handleBackButton);
                    }
                } catch (e) {
                    this.handleException(e);
                }
            },
    
            onExit: function() {
                try {
                    // Clean up popstate listener on controller exit
                    if (this._handleBackButton) {
                        window.removeEventListener("popstate", this._handleBackButton);
                        this._handleBackButton = null;
                    }
                } catch (e) {
                    this.handleException(e);
                }
            },
            onCancel: function() {
                try {
                    // Ask user for confirmation before canceling
                    MessageBox.confirm("Do you really want to go back?", {
                        title: "Confirm Navigation",
                        actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                        emphasizedAction: MessageBox.Action.NO,
                        onClose: function(sAction) {
                            if (sAction === MessageBox.Action.YES) {
                                // Clean up and go back to list
                                window.removeEventListener("popstate", this._handleBackButton);
                                this._handleBackButton = null;
                                var obj = this._oComponent.getModel("globalDataModel").getData();
                                obj.selectedItems = [];
                                obj.ActiveItem = {};
                                this._oComponent.getModel("globalDataModel").refresh(true);
                                var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                                // oRouter.navTo("RouteAdHocList");
                                oRouter.navTo("RouteAdHocList", {
                                    target: obj.Source
                                });
                            }
                        }.bind(this)
                    });
                } catch (e) {
                    this.handleException(e);
                }
            },
            onConfirm: function() {
                try {
                    // Trigger posting logic
                    this._handlePosting.bind(this)();
                } catch (e) {
                    this.handleException(e);
                }
            },
    
            _handlePosting: function() {
                try {
                    var obj = this._oComponent.getModel("globalDataModel").getData(),
                        payload = {};
                    // Validate mandatory fields
                    if (!obj.TargetData.Quantity || !obj.TargetData.StorageType || !obj.TargetData.StorageBin) {
                        var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                        MessageBox.error(this._getText("mandatoryFieldMissingMsg"), {
                            styleClass: bCompact ? "sapUiSizeCompact" : ""
                        });
                        return;
                    }
                    // Build payload for posting
                    payload.EWMWarehouse = obj.ActiveItem.WarehouseNumber;
                    payload.Product = obj.ActiveItem.Product;
                    payload.EWMStockType = obj.ActiveItem.SourceStockType;
                    payload.EWMStockOwner = obj.ActiveItem.StockOwner;
                    payload.EntitledToDisposeParty = obj.ActiveItem.EntitledToDisposeParty;
                    payload.AlternativeUnit = obj.ActiveItem.AlternativeUnit;
                    payload.SourceStorageType = obj.ActiveItem.StorageType;
                    payload.SourceStorageBin = obj.ActiveItem.StorageBin;
                    payload.SourceHandlingUnit = obj.ActiveItem.SourceHandlingUnit;
                    // payload.DestinationHandlingUnit = obj.ActiveItem.DestinationHandlingUnit; commented for testing
                    // payload.EWMStockType = obj.ActiveItem.SourceStockType;
    
                    payload.TargetQuantityInAltvUnit = Number(obj.TargetData.Quantity);
                    payload.DestinationStorageType = obj.TargetData.StorageType;
                    payload.DestinationStorageBin = obj.TargetData.StorageBin;
    
                    payload.WarehouseProcessType = "9999"; // fixed value
    
                    // Post data to backend
                    this._postService(payload,obj.ActiveItem);
                } catch (e) {
                    this.handleException(e);
                }
    
            },
    
            _postService: function(payload, sourceData) {
                try {
                    var obj = this._oComponent.getModel("globalDataModel").getData()
                    obj.errorMessages = [];
                    this._oComponent.getModel("globalDataModel").refresh(true);
                    var sUrl = "/sap/opu/odata4/sap/api_warehouse_order_task_2/srvd_a2x/sap/warehouseorder/0001/WarehouseTask";
                    var sToken = "";
                    BusyIndicator.show();
                    // Fetch CSRF token
                    $.ajax({
                        url: sUrl,
                        type: "GET",
                        headers: {
                            "X-CSRF-Token": "Fetch"
                        },
                        success: function(data, textStatus, jqXHR) {
                            sToken = jqXHR.getResponseHeader("X-CSRF-Token");
                            // Use token to post data
                            $.ajax({
                                url: sUrl,
                                type: "POST",
                                contentType: "application/json",
                                data: JSON.stringify(payload),
                                headers: {
                                    "X-CSRF-Token": sToken,
                                    "Accept": "application/json"
                                },
                                success: function(response) {
                                    console.log("POST success:", response);

                                    this.assignResourceFlow.bind(this)(response.EWMWarehouse, response.WarehouseOrder, response.WarehouseTask, response.WarehouseTaskItem, response, sourceData);
                                }.bind(this),
                                error: function(xhr, status, error) {
                                    BusyIndicator.hide();
                                    this._handlePostingFailure.bind(this)(xhr.responseText);
                                }.bind(this)
                            });
                        }.bind(this),
                        error: function(xhr, status, error) {
                            BusyIndicator.hide();
                            console.error("CSRF Token fetch failed:", xhr.responseText);
                        }
                    });
                } catch (e) {
                    this.handleException(e);
                }
            },

            assignResourceFlow: async function (WarehouseNumber, WarehouseOrder,WarehouseTask , WarehouseTaskItem, data, sourceData) {
                try {
                    // Step 1: Fetch CSRF Token and ETag
                    const { Token, Etag } = await this._fetchEtagAndTokenForResouceAssignment(WarehouseNumber, WarehouseOrder);
            
                    // Step 2: Log on to the warehouse resource
                    await this._logonToWarehouseResource(WarehouseNumber, Token);
            
                    // Step 3: Assign resource to the warehouse order
                    await this._assignResouce(WarehouseNumber, WarehouseOrder, Token, Etag);
                    // Step 3.1: Conirm warehouse task Exact
                    if((!sourceData.SerialNumber && !sourceData.SourceHandlingUnit) || (!sourceData.SerialNumber && sourceData.SourceHandlingUnit) || (sourceData.SerialNumber && !sourceData.SourceHandlingUnit))
                    await this._ConfirmWarehouseTaskExact(WarehouseNumber,WarehouseTask , WarehouseTaskItem, Token, Etag);
                    
                    
                    else if((sourceData.SerialNumber && sourceData.SourceHandlingUnit)){
                       // Step 3.1.1: Conirm warehouse task Product
                        await this._ConfirmWarehouseTaskProduct(WarehouseNumber,WarehouseTask , WarehouseTaskItem, Token, Etag, data);

                        // Step 3.2: Add Serial number to task
                        // await this._AddSrlNmbrToTaskConf(WarehouseNumber,WarehouseTask , WarehouseTaskItem, Token, Etag, sourceData.SerialNumber);
                    }
                    else
                    //Step 3.3: Confirm 
                    await this._confirm(WarehouseNumber,WarehouseTask , WarehouseTaskItem, Token, Etag);
                    // Step 4: Log off from the warehouse resource
                    await this._logonOffWarehouseResource(WarehouseNumber, Token);
            
                    // Final success message (optional)
                    console.log("Resource successfully assigned and logged off.");
                    BusyIndicator.hide();
                    // Success message and navigate forward
                    var message = this._getText("warehouseOrderConfirmed", WarehouseOrder)
                    MessageBox.success(message, {
                        actions: ["Ok"],
                        emphasizedAction: "Ok",
                        onClose: function(sAction) {
                            this._handlePostingSuccess.bind(this)();
                        }.bind(this),
                        dependentOn: this.getView()
                    });
            
                } catch (error) {
                    BusyIndicator.hide();
                    // Handle any errors that occurred in the process
                    MessageBox.error(error, {
                        actions: ["Ok"],
                        emphasizedAction: "Ok",
                        onClose: function(sAction) {
                        }.bind(this),
                        dependentOn: this.getView()
                    });
                    console.error("Error during resource assignment flow:", error);
                }
            },

            onValueHelpConfirm: function(oEvent, source) {
                try {
                    // Update selected value from value help dialog
                    var obj = this._oComponent.getModel("globalDataModel").getData();
                    switch (source) {
                        case 'SB':
                            obj.TargetData.StorageBin = oEvent.getParameter("selectedItem").getTitle();
                            break;
                        case 'HU':
                            obj.TargetData.HandlingUnit = oEvent.getParameter("selectedItem").getTitle();
                            break;
                        case 'ST':
                            obj.TargetData.StorageType = oEvent.getParameter("selectedItem").getTitle();
                            obj.TargetData.StorageBin = "";
                            break;
                    }
                    this._oComponent.getModel("globalDataModel").refresh(true);
                } catch (e) {
                    this.handleException(e);
                }
            },
    
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
                } catch (e) {
                    this.handleException(e);
                }
            },
    
            _handlePostingSuccess: function() {
                try {
                    var obj = this._oComponent.getModel("globalDataModel").getData();
                    var activeItem = obj.ActiveItem;
                    // Mark item as complete
                    obj.selectedItems.forEach(item => {
                        const isMatch = Object.keys(activeItem).every(key => item[key] === activeItem[key]);
                        if (isMatch) {
                            item.Complete = true;
                        }
                    });
                    this._oComponent.getModel("globalDataModel").refresh(true);
                    var incompleteCount = obj.selectedItems.filter(item => item.Complete !== true).length;
                    if (incompleteCount > 0) {
                        // Proceed with next item
                        obj.ActiveItem = obj.selectedItems.find(item => item.Complete !== true);
                        obj.TargetData = {};
                        if(obj.ActiveItem.SourceHandlingUnit !== '')
                            obj.TargetData.Quantity = obj.ActiveItem.Quantity;
                        this._oComponent.getModel("globalDataModel").refresh(true);
                    } else {
                        // All done, go back to list
                        obj.selectedItems = [];
                        this._oComponent.getModel("globalDataModel").refresh(true);
                        this._handleBackButton = null;
                        var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                        // oRouter.navTo("RouteAdHocList");
                        oRouter.navTo("RouteAdHocList", {
                            target: obj.Source
                        });
                    }
                } catch (e) {
                    this.handleException(e);
                }
            },
    
            onErrorDialogClose: function() {
                this._errorDialog.close(); // Close error dialog
            },
    
            onScanSuccess: function(oEvent, source) {
                try {
                    const text = oEvent.getParameter("text");
                    const cancelled = oEvent.getParameter("cancelled");
    
                    if (cancelled) {
                        MessageToast.show("Scan cancelled", {
                            duration: 1000
                        });
                        return;
                    }
    
                    if (!text) return;
    
                    const obj = this._oComponent.getModel("globalDataModel").getData();
    
                    const filterConfig = {
                        'SB': {
                            path: "/ZSCM_I_StorageBinVH",
                            key: "StorageBin",
                            filterKey: "StorageBin",
                            additionalFilters: ["WarehouseNumber", "StorageType"]
                        }
                    };
    
                    const config = filterConfig[source];
                    if (!config || !config.path) {
                        return;
                    }
    
                    const filterList = [new Filter(config.key, FilterOperator.EQ, text)];
    
                    // Dynamically add additional filters if values exist
                    config.additionalFilters.forEach(field => {
                        if (field === 'WarehouseNumber') {
                            const value = obj.HeaderFilter[field];
                            if (value) {
                                filterList.push(new Filter(field, FilterOperator.EQ, value));
                            }
                        } else {
                            const value = obj.TargetData[field];
                            if (value) {
                                filterList.push(new Filter(field, FilterOperator.EQ, value));
                            }
                        }
                    });
    
                    const that = this;
    
                    const validateScan = () => {
                        return new Promise((resolve, reject) => {
                            that._validateScanValue(config.path, filterList, resolve, reject);
                        });
                    };
    
                    const onSuccess = () => {
                        obj.TargetData[config.filterKey] = text;
                        that._oComponent.getModel("globalDataModel").refresh(true);
                    };
    
                    const onError = () => {
                        obj.TargetData[config.filterKey] = '';
                        that._oComponent.getModel("globalDataModel").refresh(true);
                    };
    
                    validateScan().then(onSuccess).catch(onError);
    
                } catch (e) {
                    this.handleException(e);
                }
            },
    
            // Utility formatter for pending item count
            handlePendingItems: function(items) {
                var incompleteCount = 0;
                if (items)
                    incompleteCount = items.filter(item => item.Complete !== true).length;
                return "Pending item(s) = " + incompleteCount;
            }
    
        });
    });