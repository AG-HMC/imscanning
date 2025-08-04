sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function(Controller, BusyIndicator, MessageBox, MessageToast, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("imscanning.controller.BaseController", {
        // Generic error handler that displays exception details in a MessageBox
        handleException: function(ex) {
            var msgTitle = "System Exception";
            var stackTrace = ex.stack || "";
            var msgBody = ex.message || "Unknown error occurred";

            // Extract function, file, line, and column from the error stack trace
            var match = stackTrace.match(/at (.*) \((.*):(\d+):(\d+)\)/);

            if (match) {
                var functionName = match[1];
                var fileName = match[2];
                var line = match[3];
                var column = match[4];

                // Append detailed location info to the message body
                msgBody += `\nFunction: ${functionName}\nFile: ${fileName}\nLine: ${line}, Column: ${column}`;
            }

            // Show error message with stack trace
            MessageBox.show(msgBody, {
                icon: sap.m.MessageBox.Icon.ERROR,
                title: msgTitle,
                details: stackTrace // optional full trace
            });

            BusyIndicator.hide();
        },

        // Handles service call failure by parsing error response and showing relevant messages
        serviceCallFailureMessageHandling: function(error) {
            try {
                BusyIndicator.hide();
                if (error.response) {
                    // Handle non-SAP server errors
                    if (error.response.headers.server !== "SAP" && error.response.headers.server !== undefined) {
                        var ref = JSON.parse(error.responseText).error;
                        if (!ref.innererror.errordetails[0].message) {
                            MessageToast.show(ref.message.value);
                        } else {
                            var finalErrorMessage = "";
                            var i;
                            // Concatenate all error details into one message
                            for (i = 0; i < ref.innererror.errordetails.length - 1; i++) {
                                if (finalErrorMessage === "") {
                                    finalErrorMessage = ref.innererror.errordetails[i].message;
                                } else {
                                    finalErrorMessage = finalErrorMessage.concat("\n", ref.innererror.errordetails[i].message);
                                }
                            }
                            MessageToast.show(finalErrorMessage);
                        }
                    } else {
                        // Parse and display SAP XML error messages
                        var oParser = new DOMParser();
                        var oDOM = oParser.parseFromString(error.responseText, "application/xml");
                        var htmlVal = oDOM.documentElement.outerHTML;
                        var span = document.createElement('span');
                        span.innerHTML = htmlVal;
                        MessageToast.show(span.textContent);
                    }
                } else {
                    // Fallback for errors with only headers
                    if (error.headers) {
                        if (error.headers.server === 'SAP' || error.headers.server.includes('sap')) {
                            oParser = new DOMParser();
                            oDOM = oParser.parseFromString(error.responseText, "application/xml");
                            htmlVal = oDOM.documentElement.outerHTML;
                            span = document.createElement('span');
                            span.innerHTML = htmlVal;
                            MessageToast.show(span.textContent);
                        } else {
                            var errorSting = "";
                            // Aggregate error messages from JSON payload
                            for (var i = 0; i < JSON.parse(error.responseText).error.innererror.errordetails.length; i++) {
                                if (!errorSting)
                                    errorSting = JSON.parse(error.responseText).error.innererror.errordetails[i].message;
                                else
                                    errorSting = errorSting.concat(" \n ", JSON.parse(error.responseText).error.innererror.errordetails[i].message);
                            }
                            if (errorSting !== "")
                                MessageBox.error(errorSting);
                            else
                                MessageBox.error(JSON.parse(error.responseText).error.message.value);
                        }
                    }
                }
                BusyIndicator.hide();
            } catch (e) {
                // Fallback in case of failure while handling the error itself
                var oParser = new DOMParser();
                var oDOM = oParser.parseFromString(error.responseText, "application/xml");
                var htmlVal = oDOM.documentElement.outerHTML;
                var span = document.createElement('span');
                span.innerHTML = htmlVal;
                MessageToast.show(span.textContent);
            }
        },

        // Validates a scanned value via backend service call
        _validateScanValue: function(path, filter, resolve, reject, messageText) {
            try {
                BusyIndicator.show();
                this._oComponent.getModel("valueHelpModel").read(path, {
                    filters: filter,
                    success: function(data) {
                        BusyIndicator.hide();
                        if (data.results.length > 0)
                            resolve(data);
                        else {
                            // Show message if no data found
                            var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
                            MessageBox.error(messageText, {
                                styleClass: bCompact ? "sapUiSizeCompact" : ""
                            });
                            reject();
                        }
                    }.bind(this),
                    error: function(error) {
                        BusyIndicator.hide();
                        this.serviceCallFailureMessageHandling(error);
                        reject();
                    }.bind(this)
                });
            } catch (e) {
                this.handleException(e);
            }
        },

        // Gets internationalized text from i18n model
        _getText: function(id, value) {
            var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
            var sText = oResourceBundle.getText(id, [value]);
            return (sText);
        },

        // Filters the value help dialog items based on user search input
        onValueHelpSearch: function(oEvent, source) {
            try {
                const searchText = oEvent.getParameter("value");
                const obj = this._oComponent.getModel("globalDataModel").getData();
                const headerFilter = obj.HeaderFilter || {};
                const filterList = [];

                // Define filter logic per source type
                const filterConfig = {
                    'WH': {
                        searchFields: ["WarehouseNumber", "WarehouseNumber_Text"],
                        additionalFilters: []
                    },
                    'ST': {
                        searchFields: ["StorageType", "StorageType_Text"],
                        additionalFilters: ["WarehouseNumber"]
                    },
                    'SB': {
                        searchFields: ["StorageBin"],
                        additionalFilters: ["WarehouseNumber", "StorageType"]
                    },
                    'HU': {
                        searchFields: ["HandlingUnit"],
                        additionalFilters: ["WarehouseNumber", "StorageType", "StorageBin"]
                    },
                    'Product': {
                        searchFields: ["Product", "ProductDescription"],
                        additionalFilters: ["WarehouseNumber", "StorageType", "StorageBin"]
                    },
                    'Batch': {
                        searchFields: ["Batch"],
                        additionalFilters: ["WarehouseNumber", "StorageType", "StorageBin", "Product"]
                    },
                    'Stock Type': {
                        searchFields: ["StockType", "StockTypeText"],
                        additionalFilters: ["WarehouseNumber"]
                    },
                    'Stock Type Target': {
                        searchFields: ["StockType", "StockTypeText"],
                        additionalFilters: ["WarehouseNumber"]
                    }
                };

                // Create search field filters
                const config = filterConfig[source];
                if (!config) return;

                // Add search text filters
                config.searchFields.forEach(field => {
                    filterList.push(new Filter(field, FilterOperator.Contains, searchText));
                });

                // Add contextual filters based on existing header values
                config.additionalFilters.forEach(field => {
                    const value = headerFilter[field];
                    if (value) {
                        filterList.push(new Filter(field, FilterOperator.EQ, value));
                    }
                });

                // Combine and apply filters to dialog items
                const oCombinedFilter = new Filter({
                    filters: filterList,
                    and: false
                });

                this._valueHelpDialog
                    .getAggregation('_dialog')
                    .getContent()[1]
                    .getBinding('items')
                    .filter([oCombinedFilter]);

            } catch (e) {
                this.handleException(e);
            }
        },

        // Opens a value help dialog fragment and applies contextual filters
        onValueHelpRequest: function(source) {
            try {
                // Map each source to its corresponding fragment and required filters
                const fragmentMap = {
                    'WH': {
                        path: "imscanning.view.fragments.WarehouseVH",
                        additionalFilters: []
                    },
                    'ST': {
                        path: "imscanning.view.fragments.StorageTypeVH",
                        additionalFilters: ["WarehouseNumber"]
                    },
                    'SB': {
                        path: "imscanning.view.fragments.StorageBinVH",
                        additionalFilters: ["WarehouseNumber", "StorageType"]
                    },
                    'SB_T': {
                        path: "imscanning.view.fragments.StorageBinVH",
                        additionalFilters: ["WarehouseNumber", "StorageType"]
                    },
                    'HU': {
                        path: "imscanning.view.fragments.HandlingUnitVH",
                        additionalFilters: ["WarehouseNumber", "StorageType", "StorageBin"]
                    },
                    'Product': {
                        path: "imscanning.view.fragments.ProductVH",
                        additionalFilters: ["WarehouseNumber", "StorageType", "StorageBin"]
                    },
                    'Batch': {
                        path: "imscanning.view.fragments.BatchVH",
                        additionalFilters: ["WarehouseNumber", "StorageType", "StorageBin", "Product"]
                    },
                    'Stock Type': {
                        path: "imscanning.view.fragments.StockTypeVH",
                        additionalFilters: ["WarehouseNumber"]
                    },
                    'Stock Type Target': {
                        path: "imscanning.view.fragments.StockTypeVHT",
                        additionalFilters: ["WarehouseNumber"]
                    }
                };

                const config = fragmentMap[source];
                if (!config) {
                    console.warn(`No fragment configuration for source: ${source}`);
                    return;
                }

                // Create and open the dialog
                this._valueHelpDialog = sap.ui.xmlfragment(config.path, this);
                this.getView().addDependent(this._valueHelpDialog);
                this._valueHelpDialog.open();

                // Prepare and apply filters based on HeaderFilter or TargetData
                const obj = this._oComponent.getModel("globalDataModel").getData();
                const headerFilter = obj.HeaderFilter || {};
                const filterList = [];

                config.additionalFilters.forEach(field => {
                    console.log(source);
                    if (source !== 'SB_T') {
                        const value = headerFilter[field];
                        if (value) {
                            filterList.push(new Filter(field, FilterOperator.EQ, value));
                        }
                    } else {
                        if (field === 'WarehouseNumber') {
                            const value = headerFilter[field];
                            if (value) {
                                filterList.push(new Filter(field, FilterOperator.EQ, value));
                            }
                        } else {
                            const value = obj.TargetData[field];
                            if (value) {
                                filterList.push(new Filter(field, FilterOperator.EQ, value));
                            }
                        }
                    }
                });

                // Apply combined filters to the dialog's item binding
                if (filterList.length) {
                    const oCombinedFilter = new Filter({
                        filters: filterList,
                        and: true
                    });

                    const oItemsBinding = this._valueHelpDialog
                        .getAggregation('_dialog')
                        .getContent()[1]
                        .getBinding('items');

                    if (oItemsBinding) {
                        oItemsBinding.filter([oCombinedFilter]);
                    }
                }

            } catch (e) {
                this.handleException(e);
            }
        },

        handleErrorCount: function(list){
            if(list){
            var errorCount = $.grep(list, function(item) {
                return item.type === "Error";
              }).length;
              return errorCount;
            }
            else
            return 0;
        },

        handleErrorCountVisible: function(list){
            if(list){
                var errorCount = $.grep(list, function(item) {
                    return item.type === "Error";
                  }).length;
                  if(errorCount > 0)
                    return true;
                else
                return false;
                }
                else
                return false;
        },

        handleMessageViewPress: function(){
            this._errorDialog.open();
        },

        onItemSelect: function() {
            // sap.ui.getCore().byId("backButton").setVisible(true);
            this.getView().byId("errorDialogFragment--backButton").setVisible(true);
        },

        onBackPress: function() {
            this._errorDialog.getContent()[0].navigateBack();
            // sap.ui.getCore().byId("backButton").setVisible(false);
            this.getView().byId("errorDialogFragment--backButton").setVisible(false);
        }, 

        // Gets CSRF token and ETag for resource assignment
        _fetchEtagAndTokenForResouceAssignment: function(WarehouseNumber, WarehouseOrder) {
            return new Promise((resolve, reject) => {
                var sToken = "";
                var sUrl = "/sap/opu/odata4/sap/api_warehouse_order_task_2/srvd_a2x/sap/warehouseorder/0001/WarehouseOrder(EWMWarehouse='" + WarehouseNumber + "',WarehouseOrder='" + WarehouseOrder + "')";
                $.ajax({
                    url: sUrl,
                    type: "GET",
                    headers: {
                        "X-CSRF-Token": "Fetch"
                    },
                    success: function(response, textStatus, jqXHR) {
                        sToken = jqXHR.getResponseHeader("X-CSRF-Token");
                        resolve({
                            Token: sToken,
                            Etag: response['@odata.etag']
                        });
                        
                    }.bind(this),
                    error: function(xhr, status, error) {
                       
                        reject(xhr.responseText);
                    }.bind(this)
                });
            });
        },

        // Logs on to the warehouse resource
        _logonToWarehouseResource: function(WarehouseNumber, sToken) {
            return new Promise((resolve, reject) => {
                if (sap.ushell.Container.getService("UserInfo").getId() !== 'DEFAULT_USER')
                    var Resource = sap.ushell.Container.getService("UserInfo").getId();
                    else
                        Resource = "SAKTHEESWA";
                var sUrl = "/sap/opu/odata4/sap/api_warehouse_resource_2/srvd_a2x/sap/warehouseresource/0001/WarehouseResource(EWMWarehouse='" + WarehouseNumber + "',EWMResource='" + Resource + "')/SAP__self.LogonToWarehouseResource";

                jQuery.ajax({
                    url: sUrl,
                    method: "POST",
                    contentType: "application/json",
                    headers: {
                        "X-CSRF-Token": sToken,
                        "Accept": "application/json"
                    },
                    success: function(oData) {
                        console.log("PATCH Success:", oData);
                        // Handle success
                        resolve();
                      
                    }.bind(this),
                    error: function(oError) {
                        const errorMsg = oError?.responseText ? JSON.parse(oError.responseText).error.message : "Unknown error";
                        reject(errorMsg);
                     
                    }.bind(this)
                });
            });
        },

        // Assigns a resource to a warehouse order
        _assignResouce: function(WarehouseNumber, WarehouseOrder, sToken, etag) {
            return new Promise((resolve, reject) => {
                var sUrl = "/sap/opu/odata4/sap/api_warehouse_order_task_2/srvd_a2x/sap/warehouseorder/0001/WarehouseOrder(EWMWarehouse='" + WarehouseNumber + "',WarehouseOrder='" + WarehouseOrder + "')/SAP__self.AssignWarehouseOrder";
                if (sap.ushell.Container.getService("UserInfo").getId() !== 'DEFAULT_USER')
                    var Resource = sap.ushell.Container.getService("UserInfo").getId();
                    else
                        Resource = "SAKTHEESWA";
                var oPayload = {
                    "EWMResource": Resource
                };

                jQuery.ajax({
                    url: sUrl,
                    method: "POST",
                    contentType: "application/json",
                    headers: {
                        "X-CSRF-Token": sToken,
                        "Accept": "application/json",
                        "If-Match": etag
                    },
                    data: JSON.stringify(oPayload),
                    success: function(oData) {
                        console.log("PATCH Success:", oData);
                        resolve();
              
                    }.bind(this),
                    error: function(oError) {
                        const errorMsg = oError?.responseText ? JSON.parse(oError.responseText).error.message : "Unknown error";
                        reject(errorMsg);
         
                    }.bind(this)
                });
            });
        },

        // Logs off the currently assigned resource
        _logonOffWarehouseResource: function(WarehouseNumber, sToken) {
            return new Promise((resolve, reject) => {
                if (sap.ushell.Container.getService("UserInfo").getId() !== 'DEFAULT_USER')
                var Resource = sap.ushell.Container.getService("UserInfo").getId();
                else
                    Resource = "SAKTHEESWA";
                var sUrl = "/sap/opu/odata4/sap/api_warehouse_resource_2/srvd_a2x/sap/warehouseresource/0001/WarehouseResource(EWMWarehouse='" + WarehouseNumber + "',EWMResource='" + Resource + "')/SAP__self.LogoffFromWarehouseResource";

                jQuery.ajax({
                    url: sUrl,
                    method: "POST",
                    contentType: "application/json",
                    headers: {
                        "X-CSRF-Token": sToken,
                        "Accept": "application/json"
                    },
                    success: function(oData) {
                        resolve();

                    }.bind(this),
                    error: function(oError) {
                        const errorMsg = oError?.responseText ? JSON.parse(oError.responseText).error.message : "Unknown error";
                        reject(errorMsg);
            
                    }.bind(this)
                });
            });
        },

        _unassignWarehouseResource: function(WarehouseNumber, WarehouseOrder, sToken, etag){
            return new Promise((resolve, reject) => {
                var sUrl = "/sap/opu/odata4/sap/api_warehouse_order_task_2/srvd_a2x/sap/warehouseorder/0001/WarehouseOrder(EWMWarehouse='" + WarehouseNumber + "',WarehouseOrder='" + WarehouseOrder + "')/SAP__self.UnassignWarehouseOrder";

                jQuery.ajax({
                    url: sUrl,
                    method: "POST",
                    contentType: "application/json",
                    headers: {
                        "X-CSRF-Token": sToken,
                        "Accept": "application/json",
                        "If-Match": etag
                    },
                    success: function(oData) {
                        console.log("PATCH Success:", oData);
                        resolve();
              
                    }.bind(this),
                    error: function(oError) {
                        const errorMsg = oError?.responseText ? JSON.parse(oError.responseText).error.message : "Unknown error";
                        reject(errorMsg);
         
                    }.bind(this)
                });
            });
        },

        // Assigns a resource to a warehouse order
        _confirm: function(WarehouseNumber, WarehouseTask, WarehouseTaskItem, sToken, etag) {
            return new Promise((resolve, reject) => {
                var sUrl = "/sap/opu/odata4/sap/api_warehouse_order_task_2/srvd_a2x/sap/warehouseorder/0001/WarehouseTask(EWMWarehouse='" + WarehouseNumber + "',WarehouseTask='" + WarehouseTask + "',WarehouseTaskItem='" + WarehouseTaskItem +    "')/SAP__self.ConfirmWarehouseTaskExact";

                jQuery.ajax({
                    url: sUrl,
                    method: "POST",
                    contentType: "application/json",
                    headers: {
                        "X-CSRF-Token": sToken,
                        "Accept": "application/json",
                        "If-Match": etag
                    },
                    // data: JSON.stringify(oPayload),
                    success: function(oData) {
                        console.log("PATCH Success:", oData);
                        resolve();
              
                    }.bind(this),
                    error: function(oError) {
                        const errorMsg = oError?.responseText ? JSON.parse(oError.responseText).error.message : "Unknown error";
                        reject(errorMsg);
         
                    }.bind(this)
                });
            });
        },

        _ConfirmWarehouseTaskProduct: function(WarehouseNumber, WarehouseTask, WarehouseTaskItem, sToken, etag, item){
            return new Promise((resolve, reject) => {
                var sUrl = "/sap/opu/odata4/sap/api_warehouse_order_task_2/srvd_a2x/sap/warehouseorder/0001/WarehouseTask(EWMWarehouse='" + WarehouseNumber + "',WarehouseTask='" + WarehouseTask + "',WarehouseTaskItem='" + WarehouseTaskItem +    "')/SAP__self.ConfirmWarehouseTaskProduct";
                var oPayload = {
                    AlternativeUnit: item.AlternativeUnit,
                    ActualQuantityInAltvUnit: item.TargetQuantityInAltvUnit,
                    DifferenceQuantityInAltvUnit: 0,
                    WhseTaskExceptionCodeQtyDiff: "",
                    DestinationStorageBin: item.DestinationStorageBin,
                    WhseTaskExCodeDestStorageBin: "",
                    SourceHandlingUnit: item.SourceHandlingUnit,
                    DestinationHandlingUnit: item.DestinationHandlingUnit,
                }
                jQuery.ajax({
                    url: sUrl,
                    method: "POST",
                    contentType: "application/json",
                    headers: {
                        "X-CSRF-Token": sToken,
                        "Accept": "application/json",
                        "If-Match": etag
                    },
                    data: JSON.stringify(oPayload),
                    success: function(oData) {
                        console.log("PATCH Success:", oData);
                        resolve();
              
                    }.bind(this),
                    error: function(oError) {
                        const errorMsg = oError?.responseText ? JSON.parse(oError.responseText).error.message : "Unknown error";
                        reject(errorMsg);
         
                    }.bind(this)
                });
            });
        },

        _AddSrlNmbrToTaskConf: function(WarehouseNumber, WarehouseTask, WarehouseTaskItem, sToken, etag, SerialNumber){
            return new Promise((resolve, reject) => {
                var sUrl = "/sap/opu/odata4/sap/api_warehouse_order_task_2/srvd_a2x/sap/warehouseorder/0001/WarehouseTask(EWMWarehouse='" + WarehouseNumber + "',WarehouseTask='" + WarehouseTask + "',WarehouseTaskItem='" + WarehouseTaskItem +    "')/SAP__self.AddSrlNmbrToTaskConf";
                var oPayload = {
                    "EWMSerialNumber" : SerialNumber
                };
                jQuery.ajax({
                    url: sUrl,
                    method: "POST",
                    contentType: "application/json",
                    headers: {
                        "X-CSRF-Token": sToken,
                        "Accept": "application/json",
                        "If-Match": etag
                    },
                    data: JSON.stringify(oPayload),
                    success: function(oData) {
                        console.log("PATCH Success:", oData);
                        resolve();
              
                    }.bind(this),
                    error: function(oError) {
                        const errorMsg = oError?.responseText ? JSON.parse(oError.responseText).error.message : "Unknown error";
                        reject(errorMsg);
         
                    }.bind(this)
                });
            });
        },

        _ConfirmWarehouseTaskExact: function(WarehouseNumber, WarehouseTask, WarehouseTaskItem, sToken, etag){
            return new Promise((resolve, reject) => {
                var sUrl = "/sap/opu/odata4/sap/api_warehouse_order_task_2/srvd_a2x/sap/warehouseorder/0001/WarehouseTask(EWMWarehouse='" + WarehouseNumber + "',WarehouseTask='" + WarehouseTask + "',WarehouseTaskItem='" + WarehouseTaskItem +    "')/SAP__self.ConfirmWarehouseTaskExact";
                
                jQuery.ajax({
                    url: sUrl,
                    method: "POST",
                    contentType: "application/json",
                    headers: {
                        "X-CSRF-Token": sToken,
                        "Accept": "application/json",
                        "If-Match": etag
                    },
                    // data: JSON.stringify(oPayload),
                    success: function(oData) {
                        console.log("PATCH Success:", oData);
                        resolve();
              
                    }.bind(this),
                    error: function(oError) {
                        const errorMsg = oError?.responseText ? JSON.parse(oError.responseText).error.message : "Unknown error";
                        reject(errorMsg);
         
                    }.bind(this)
                });
            });
        }
    });
});