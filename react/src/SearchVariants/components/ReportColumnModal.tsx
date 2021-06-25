import React from "react";
import {
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    FormControl,
    FormControlLabel,
    FormGroup,
    Grid,
} from "@material-ui/core";
import { Add, Clear } from "@material-ui/icons";
import { DialogHeader } from "../../components";

export interface ReportColumnModalProps {
    open: boolean;
    onClose: () => void;
    selectedColumns: string[];
    allColumns: string[];
    setSelected: React.Dispatch<React.SetStateAction<string[]>>;
}

export function ReportColumnModal(props: ReportColumnModalProps) {
    const handleClick = (clicked: string) => {
        props.setSelected(oldColumns =>
            oldColumns.includes(clicked)
                ? oldColumns.filter(c => c !== clicked)
                : oldColumns.concat(clicked)
        );
    };

    const selectedText =
        props.selectedColumns.length === 0
            ? "None selected"
            : props.selectedColumns.length === props.allColumns.length
            ? "All selected"
            : `${props.selectedColumns.length} of ${props.allColumns.length} selected`;

    return (
        <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="md">
            <DialogHeader id="report-column-modal-header" onClose={props.onClose}>
                <div>Add or Remove Report Columns {`(${selectedText})`}</div>
            </DialogHeader>
            <DialogContent dividers>
                <Grid container spacing={1}>
                    <FormControl component="fieldset">
                        <FormGroup row>
                            {props.allColumns.map(col => (
                                <Grid key={col} item xs={12} sm={6} md={4}>
                                    <FormControlLabel
                                        key={col}
                                        label={col}
                                        control={
                                            <Checkbox
                                                color="default"
                                                checked={props.selectedColumns.includes(col)}
                                                onChange={() => handleClick(col)}
                                                name={col}
                                            />
                                        }
                                    />
                                </Grid>
                            ))}
                        </FormGroup>
                    </FormControl>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button
                    startIcon={<Add />}
                    variant="contained"
                    onClick={() => props.setSelected(props.allColumns)}
                >
                    Select All
                </Button>
                <Button
                    startIcon={<Clear />}
                    variant="contained"
                    onClick={() => props.setSelected([])}
                >
                    Deselect All
                </Button>
            </DialogActions>
        </Dialog>
    );
}
