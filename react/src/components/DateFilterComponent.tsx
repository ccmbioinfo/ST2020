import React from "react";
import { Column } from "@material-table/core";
import { IconButton, InputAdornment, makeStyles, TextField, Tooltip } from "@material-ui/core";
import { NavigateBefore } from "@material-ui/icons";
import clsx from "clsx";

const useStyles = makeStyles(theme => ({
    button: {
        transform: "rotate(0deg)",
        transition: theme.transitions.create("transform", {
            duration: theme.transitions.duration.shortest,
        }),
    },
    buttonFlipped: {
        transform: "rotate(180deg)",
    },
}));

/**
 * A filter component for material-table for sorting before or after
 * a specific date. Passes up a value of the format "{before,after},yyyy-mm-dd".
 */
export default function DateFilterComponent<RowData extends object>(props: {
    columnDef: Column<RowData>;
    onFilterChanged: (rowId: string, value: any) => void;
}) {
    const classes = useStyles();
    const filterValue: string | null = (props.columnDef as any).tableData.filterValue || null;
    const isBefore = filterValue === null ? true : filterValue.split(",")?.[0] === "before";
    const date = filterValue?.split(",")?.[1] || "";

    function updateFilter(newBefore: boolean, newDate: string | null) {
        // https://github.com/mbrn/material-table/pull/2435
        const rowId = (props.columnDef as any).tableData.id;
        if (newDate) {
            props.onFilterChanged(rowId, `${newBefore ? "before" : "after"},${newDate}`);
        } else {
            props.onFilterChanged(rowId, null);
        }
    }

    return (
        <TextField
            id="date"
            type="date"
            value={date}
            InputProps={{
                startAdornment: (
                    <InputAdornment position="start">
                        <Tooltip title={isBefore ? "Before" : "After"}>
                            {/* prevent mui warnings about tooltip wrapping disabled button */}
                            <span>
                                <IconButton
                                    disabled={filterValue === null}
                                    size="small"
                                    className={clsx(classes.button, {
                                        [classes.buttonFlipped]: !isBefore,
                                    })}
                                    onClick={() => updateFilter(!isBefore, date)}
                                >
                                    <NavigateBefore />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </InputAdornment>
                ),
            }}
            InputLabelProps={{
                shrink: true,
            }}
            onChange={e => updateFilter(isBefore, e.target.value)}
        />
    );
}
